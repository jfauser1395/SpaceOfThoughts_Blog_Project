using System.Buffers.Binary;
using ImageMagick;
using ImageMagick.Configuration;
using ImageMagick.Formats;

namespace SpaceOfThoughts.API.Imaging
{
    /// <summary>
    /// Decodes every uploaded raster image into trusted pixels before it reaches
    /// storage. The output is one browser-compatible WebP master, bounded to a
    /// useful web resolution and stripped of private camera metadata.
    /// </summary>
    public sealed class ImageUploadProcessor : IImageUploadProcessor, IDisposable
    {
        public const string OutputFileExtension = ".webp";
        public const string OutputContentType = "image/webp";
        public const long MaximumGeneralUploadBytes = 10 * 1024 * 1024;
        public const long MaximumProfileUploadBytes = 5 * 1024 * 1024;

        // Centred framing used until the user crops the profile image, and the
        // zoom range the crop controls allow
        public const string DefaultProfilePosition = "50% 50% 100%";
        public const int DefaultProfileZoomPercent = 100;
        public const int MinimumProfileZoomPercent = 85;
        public const int MaximumProfileZoomPercent = 170;

        // File types accepted for a profile image upload
        public static readonly string[] AllowedProfileExtensions =
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".avif"
        };

        private const ulong MaximumDecodedPixels = 40_000_000;
        private const uint MaximumGeneralEdge = 3_840;
        private const uint MaximumProfileEdge = 1_024;
        private const uint GeneralPhotoQuality = 94;
        private const uint ProfilePhotoQuality = 95;
        private const int HeaderProbeLength = 256;

        // Production runs on a Raspberry Pi. Serializing encodes prevents two
        // large uploads from exhausting its memory while still letting libwebp
        // use a small number of worker threads for one image.
        private readonly SemaphoreSlim encodingGate = new(1, 1);

        static ImageUploadProcessor()
        {
            // Magick.NET ships with ImageMagick's open policy. Uploads are
            // untrusted, so permit only the four raster coders this service
            // explicitly identifies and force all external delegates off.
            var configuration = ConfigurationFiles.Default;
            configuration.Policy.Data = """
                <policymap>
                  <policy domain="delegate" rights="none" pattern="*" />
                  <policy domain="filter" rights="none" pattern="*" />
                  <policy domain="path" rights="none" pattern="@*" />
                  <policy domain="coder" rights="none" pattern="*" />
                  <policy domain="coder" rights="read | write" pattern="{JPEG,PNG,WEBP,HEIC,AVIF}" />
                </policymap>
                """;
            MagickNET.Initialize(configuration);

            // These are process-wide ImageMagick limits. They complement the
            // compressed-byte and decoded-pixel checks below and bound hostile
            // image headers before a full pixel cache can be allocated.
            ResourceLimits.Width = 12_000;
            ResourceLimits.Height = 12_000;
            ResourceLimits.ListLength = 2;
            ResourceLimits.MaxProfileSize = 16 * 1024 * 1024;
            ResourceLimits.MaxMemoryRequest = 128 * 1024 * 1024;
            ResourceLimits.Memory = 256 * 1024 * 1024;
            ResourceLimits.Area = 256 * 1024 * 1024;
            ResourceLimits.Disk = 512 * 1024 * 1024;
            ResourceLimits.Thread = 2;
            ResourceLimits.Time = 55;
        }

        public async Task<ProcessedImageFile> ProcessAndStoreAsync(
            IFormFile file,
            string destinationDirectory,
            string outputBaseName,
            ImageUploadPurpose purpose,
            CancellationToken cancellationToken = default
        )
        {
            ArgumentNullException.ThrowIfNull(file);
            ValidateOutputBaseName(outputBaseName);

            var maximumUploadBytes = purpose == ImageUploadPurpose.ProfilePicture
                ? MaximumProfileUploadBytes
                : MaximumGeneralUploadBytes;
            if (file.Length <= 0)
            {
                throw new ImageUploadException("An image file is required.");
            }

            if (file.Length > maximumUploadBytes)
            {
                throw new ImageUploadException(
                    $"File size cannot be more than {maximumUploadBytes / (1024 * 1024)}MB."
                );
            }

            await encodingGate.WaitAsync(cancellationToken);
            try
            {
                return await ProcessWhileHoldingGateAsync(
                    file,
                    destinationDirectory,
                    outputBaseName,
                    purpose,
                    cancellationToken
                );
            }
            finally
            {
                encodingGate.Release();
            }
        }

        private static async Task<ProcessedImageFile> ProcessWhileHoldingGateAsync(
            IFormFile file,
            string destinationDirectory,
            string outputBaseName,
            ImageUploadPurpose purpose,
            CancellationToken cancellationToken
        )
        {
            Directory.CreateDirectory(destinationDirectory);

            var destinationRoot = Path.GetFullPath(destinationDirectory);
            var finalFileName = $"{outputBaseName}{OutputFileExtension}";
            var finalPath = Path.GetFullPath(
                Path.Combine(destinationRoot, finalFileName)
            );
            EnsurePathIsInsideDirectory(destinationRoot, finalPath);

            var temporaryPath = Path.Combine(
                destinationRoot,
                $".{outputBaseName}.{Guid.NewGuid():N}.upload"
            );

            try
            {
                await using var input = await OpenSeekableInputAsync(
                    file,
                    cancellationToken
                );
                var inputFormat = await DetectInputFormatAsync(
                    input,
                    cancellationToken
                );
                var imageInfoSettings = new MagickReadSettings
                {
                    Format = inputFormat,
                    FrameIndex = 0,
                    FrameCount = 1
                };

                var imageInfo = new MagickImageInfo(input, imageInfoSettings);
                ValidateDecodedDimensions(imageInfo.Width, imageInfo.Height);
                input.Position = 0;

                var readSettings = new MagickReadSettings
                {
                    Format = inputFormat,
                    FrameIndex = 0,
                    FrameCount = 2
                };
                using var frames = new MagickImageCollection();
                try
                {
                    await frames.ReadAsync(input, readSettings, cancellationToken);
                }
                catch (MagickException exception)
                {
                    throw new ImageUploadException(
                        "The uploaded file is not a valid supported image.",
                        exception
                    );
                }

                if (frames.Count != 1)
                {
                    throw new ImageUploadException(
                        "Animated or multi-frame images are not supported."
                    );
                }

                // The collection owns this image and disposes it at the end of the
                // method. Do not clone it: a 40 MP Q8 clone would keep a second
                // pixel cache alive throughout resize and encode on the Pi.
                var image = (MagickImage)frames[0];
                image.AutoOrient();
                NormalizeToSrgb(image);

                var maximumEdge = purpose == ImageUploadPurpose.ProfilePicture
                    ? MaximumProfileEdge
                    : MaximumGeneralEdge;
                ResizeToMaximumEdge(image, maximumEdge);

                // Preserve transparency and PNG-like artwork without generation
                // loss. Opaque photographs use a high perceptual quality level.
                var useLosslessEncoding = purpose != ImageUploadPurpose.ProfilePicture
                    && (inputFormat == MagickFormat.Png || !image.IsOpaque);
                image.Strip();
                image.Format = MagickFormat.WebP;
                image.Quality = useLosslessEncoding
                    ? 100u
                    : purpose == ImageUploadPurpose.ProfilePicture
                        ? ProfilePhotoQuality
                        : GeneralPhotoQuality;

                var webPOptions = new WebPWriteDefines
                {
                    Lossless = useLosslessEncoding,
                    Method = 6,
                    AlphaQuality = 100,
                    AutoFilter = !useLosslessEncoding,
                    Exact = useLosslessEncoding && !image.IsOpaque,
                    LowMemory = true,
                    ThreadLevel = true,
                    UseSharpYuv = !useLosslessEncoding
                };

                await using (var output = new FileStream(
                    temporaryPath,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None,
                    64 * 1024,
                    FileOptions.Asynchronous | FileOptions.SequentialScan
                ))
                {
                    await image.WriteAsync(output, webPOptions, cancellationToken);
                    await output.FlushAsync(cancellationToken);
                }

                try
                {
                    File.Move(temporaryPath, finalPath, overwrite: false);
                }
                catch (IOException exception) when (File.Exists(finalPath))
                {
                    throw new ImageUploadException(
                        $"An image file named '{finalFileName}' already exists.",
                        exception
                    );
                }

                return new ProcessedImageFile(
                    finalFileName,
                    finalPath,
                    OutputFileExtension,
                    OutputContentType,
                    image.Width,
                    image.Height,
                    new FileInfo(finalPath).Length,
                    useLosslessEncoding
                );
            }
            catch (ImageUploadException)
            {
                DeleteIfPresent(temporaryPath);
                throw;
            }
            catch (OperationCanceledException)
            {
                DeleteIfPresent(temporaryPath);
                throw;
            }
            catch (MagickException exception)
            {
                DeleteIfPresent(temporaryPath);
                throw new ImageUploadException(
                    "The image could not be processed safely.",
                    exception
                );
            }
            catch
            {
                DeleteIfPresent(temporaryPath);
                throw;
            }
        }

        private static async Task<Stream> OpenSeekableInputAsync(
            IFormFile file,
            CancellationToken cancellationToken
        )
        {
            var input = file.OpenReadStream();
            if (input.CanSeek)
            {
                return input;
            }

            await using (input)
            {
                var bufferedInput = new MemoryStream((int)file.Length);
                await input.CopyToAsync(bufferedInput, cancellationToken);
                bufferedInput.Position = 0;
                return bufferedInput;
            }
        }

        private static async Task<MagickFormat> DetectInputFormatAsync(
            Stream input,
            CancellationToken cancellationToken
        )
        {
            var header = new byte[HeaderProbeLength];
            var bytesRead = 0;
            while (bytesRead < header.Length)
            {
                var read = await input.ReadAsync(
                    header.AsMemory(bytesRead, header.Length - bytesRead),
                    cancellationToken
                );
                if (read == 0)
                {
                    break;
                }

                bytesRead += read;
            }
            input.Position = 0;

            var bytes = header.AsSpan(0, bytesRead);
            if (
                bytes.Length >= 3
                && bytes[0] == 0xff
                && bytes[1] == 0xd8
                && bytes[2] == 0xff
            )
            {
                return MagickFormat.Jpeg;
            }

            ReadOnlySpan<byte> pngSignature =
            [
                0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a
            ];
            if (bytes.StartsWith(pngSignature))
            {
                return MagickFormat.Png;
            }

            if (
                bytes.Length >= 12
                && bytes[..4].SequenceEqual("RIFF"u8)
                && bytes.Slice(8, 4).SequenceEqual("WEBP"u8)
            )
            {
                return MagickFormat.WebP;
            }

            if (IsAvifHeader(bytes))
            {
                return MagickFormat.Avif;
            }

            throw new ImageUploadException(
                "Supported image formats are JPG, PNG, WebP, and AVIF."
            );
        }

        private static bool IsAvifHeader(ReadOnlySpan<byte> bytes)
        {
            if (
                bytes.Length < 16
                || !bytes.Slice(4, 4).SequenceEqual("ftyp"u8)
            )
            {
                return false;
            }

            var declaredBoxLength = BinaryPrimitives.ReadUInt32BigEndian(bytes[..4]);
            var availableBoxLength = Math.Min(
                bytes.Length,
                declaredBoxLength > int.MaxValue
                    ? bytes.Length
                    : (int)declaredBoxLength
            );
            for (var offset = 8; offset + 4 <= availableBoxLength; offset += 4)
            {
                var brand = bytes.Slice(offset, 4);
                if (brand.SequenceEqual("avif"u8) || brand.SequenceEqual("avis"u8))
                {
                    return true;
                }
            }

            return false;
        }

        private static void ValidateDecodedDimensions(uint width, uint height)
        {
            if (width == 0 || height == 0)
            {
                throw new ImageUploadException(
                    "The uploaded image has invalid dimensions."
                );
            }

            if ((ulong)width * height > MaximumDecodedPixels)
            {
                throw new ImageUploadException(
                    "The image contains too many pixels. Use an image smaller than 40 megapixels."
                );
            }
        }

        private static void NormalizeToSrgb(MagickImage image)
        {
            var colorProfile = image.GetColorProfile();
            if (colorProfile is not null)
            {
                image.TransformColorSpace(ColorProfiles.SRGB);
                return;
            }

            if (image.ColorSpace != ColorSpace.sRGB)
            {
                image.ColorSpace = ColorSpace.sRGB;
            }
        }

        private static void ResizeToMaximumEdge(MagickImage image, uint maximumEdge)
        {
            var longestEdge = Math.Max(image.Width, image.Height);
            if (longestEdge <= maximumEdge)
            {
                return;
            }

            var scale = maximumEdge / (double)longestEdge;
            var width = Math.Max(1u, (uint)Math.Round(image.Width * scale));
            var height = Math.Max(1u, (uint)Math.Round(image.Height * scale));
            image.Resize(width, height, FilterType.Lanczos);
        }

        private static void ValidateOutputBaseName(string outputBaseName)
        {
            if (
                string.IsNullOrWhiteSpace(outputBaseName)
                || !string.Equals(
                    Path.GetFileName(outputBaseName),
                    outputBaseName,
                    StringComparison.Ordinal
                )
                || outputBaseName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0
            )
            {
                throw new ArgumentException(
                    "The output image filename is invalid.",
                    nameof(outputBaseName)
                );
            }
        }

        private static void EnsurePathIsInsideDirectory(
            string destinationRoot,
            string candidatePath
        )
        {
            var rootWithSeparator = destinationRoot.TrimEnd(
                Path.DirectorySeparatorChar,
                Path.AltDirectorySeparatorChar
            ) + Path.DirectorySeparatorChar;
            if (
                !candidatePath.StartsWith(
                    rootWithSeparator,
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                throw new ArgumentException(
                    "The output image path is outside its storage directory."
                );
            }
        }

        private static void DeleteIfPresent(string path)
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }

        public void Dispose()
        {
            encodingGate.Dispose();
        }
    }
}
