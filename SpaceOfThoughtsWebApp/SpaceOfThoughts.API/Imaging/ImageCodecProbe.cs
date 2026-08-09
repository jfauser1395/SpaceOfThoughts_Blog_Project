using ImageMagick;
using Microsoft.AspNetCore.Http;

namespace SpaceOfThoughts.API.Imaging
{
    /// <summary>
    /// One-shot native-codec check for a published target host. It requires no
    /// database or application secrets and throws when a required codec fails.
    /// </summary>
    public static class ImageCodecProbe
    {
        public const string CommandFlag = "--probe-image-codecs";

        public static async Task RunAsync(CancellationToken cancellationToken = default)
        {
            var probeDirectory = Path.Combine(
                Path.GetTempPath(),
                $"spaceofthoughts-codec-probe-{Guid.NewGuid():N}"
            );

            try
            {
                Directory.CreateDirectory(probeDirectory);
                using var processor = new ImageUploadProcessor();

                var embeddedPng = Convert.FromBase64String(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                );
                await using var pngInput = new MemoryStream();
                using (var source = new MagickImage(embeddedPng, MagickFormat.Png))
                {
                    source.SetAttribute("comment", "strip-this-probe-metadata");
                    source.Write(pngInput, MagickFormat.Png);
                }
                pngInput.Position = 0;

                var formFile = new FormFile(
                    pngInput,
                    0,
                    pngInput.Length,
                    "file",
                    "codec-probe.png"
                );
                var webP = await processor.ProcessAndStoreAsync(
                    formFile,
                    probeDirectory,
                    "codec-probe",
                    ImageUploadPurpose.PublicLibrary,
                    cancellationToken
                );

                using (var decodedWebP = new MagickImage(webP.FilePath))
                {
                    if (
                        decodedWebP.Format != MagickFormat.WebP
                        || decodedWebP.Width != 1
                        || decodedWebP.Height != 1
                        || decodedWebP.GetAttribute("comment") is not null
                    )
                    {
                        throw new InvalidOperationException(
                            "The WebP normalization probe produced an invalid result."
                        );
                    }
                }

                // AVIF is accepted as upload input and is the planned preferred
                // responsive derivative, so prove both native encode and decode
                // support even though canonical output is currently WebP.
                await using var avifBytes = new MemoryStream();
                using (var avifSource = new MagickImage(embeddedPng, MagickFormat.Png))
                {
                    avifSource.Quality = 75;
                    avifSource.Write(avifBytes, MagickFormat.Avif);
                }
                avifBytes.Position = 0;
                using var decodedAvif = new MagickImage(
                    avifBytes,
                    MagickFormat.Avif
                );
                if (decodedAvif.Width != 1 || decodedAvif.Height != 1)
                {
                    throw new InvalidOperationException(
                        "The AVIF codec probe produced invalid dimensions."
                    );
                }

                Console.WriteLine(
                    $"Image codec probe passed: WebP normalize/read/write; AVIF read/write; {MagickNET.Version}."
                );
            }
            finally
            {
                if (Directory.Exists(probeDirectory))
                {
                    Directory.Delete(probeDirectory, recursive: true);
                }
            }
        }
    }
}
