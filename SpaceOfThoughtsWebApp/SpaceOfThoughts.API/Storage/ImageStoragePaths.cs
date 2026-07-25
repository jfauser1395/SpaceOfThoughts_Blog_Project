namespace SpaceOfThoughts.API.Storage
{
    // Public image categories map upload purposes to their dedicated storage folders
    public enum PublicImageCategory
    {
        Blog,
        CoverPage,
        AboutPage
    }

    // Centralize image paths so static hosting, uploads, and deletion use the same structure
    public static class ImageStoragePaths
    {
        public const string PublicRequestPath = "/Images";
        public const string ProfilePicturesDirectoryName = "ProfilePictures";

        private const string ImagesDirectoryName = "Images";
        private const string PublicDirectoryName = "Public";
        private const string PrivateDirectoryName = "Private";

        // Create every managed image directory when the API starts
        public static void EnsureDirectories(string contentRootPath)
        {
            Directory.CreateDirectory(GetPublicRoot(contentRootPath));
            Directory.CreateDirectory(
                GetPublicDirectory(contentRootPath, PublicImageCategory.Blog)
            );
            Directory.CreateDirectory(
                GetPublicDirectory(contentRootPath, PublicImageCategory.CoverPage)
            );
            Directory.CreateDirectory(
                GetPublicDirectory(contentRootPath, PublicImageCategory.AboutPage)
            );
            Directory.CreateDirectory(GetProfilePicturesDirectory(contentRootPath));
            Directory.CreateDirectory(GetPrivateDirectory(contentRootPath));

            // Move files from the former flat layout when an existing server is upgraded
            MigrateLegacyFiles(contentRootPath);
        }

        // Return the public root that may be exposed by ASP.NET Core or Nginx
        public static string GetPublicRoot(string contentRootPath)
        {
            return Path.Combine(contentRootPath, ImagesDirectoryName, PublicDirectoryName);
        }

        // Return the public directory assigned to one editor or page type
        public static string GetPublicDirectory(
            string contentRootPath,
            PublicImageCategory category
        )
        {
            return Path.Combine(
                GetPublicRoot(contentRootPath),
                GetCategoryDirectoryName(category)
            );
        }

        // Keep user profile pictures public while separating them from page artwork
        public static string GetProfilePicturesDirectory(string contentRootPath)
        {
            return Path.Combine(
                GetPublicRoot(contentRootPath),
                ProfilePicturesDirectoryName
            );
        }

        // Return the directory that must only be accessed through authorized endpoints
        public static string GetPrivateDirectory(string contentRootPath)
        {
            return Path.Combine(contentRootPath, ImagesDirectoryName, PrivateDirectoryName);
        }

        // Accept only the known public categories supplied by the admin image selector
        public static bool TryParsePublicCategory(
            string? value,
            out PublicImageCategory category
        )
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                category = PublicImageCategory.Blog;
                return true;
            }

            return TryParseKnownPublicCategory(value.Trim(), out category);
        }

        // Build the URL path that corresponds to the public static-file folder
        public static string GetPublicUrlPath(
            PublicImageCategory category,
            string fileName
        )
        {
            return $"{PublicRequestPath}/{GetCategoryDirectoryName(category)}/{Uri.EscapeDataString(fileName)}";
        }

        // Resolve the category stored in a new or legacy public image URL
        public static PublicImageCategory GetCategoryFromUrl(string? imageUrl)
        {
            if (string.IsNullOrWhiteSpace(imageUrl))
            {
                return PublicImageCategory.Blog;
            }

            var urlPath = imageUrl;
            if (Uri.TryCreate(imageUrl, UriKind.Absolute, out var absoluteUri))
            {
                urlPath = absoluteUri.AbsolutePath;
            }
            else
            {
                urlPath = imageUrl.Split('?', '#')[0];
            }

            var markerIndex = urlPath.IndexOf(
                $"{PublicRequestPath}/",
                StringComparison.OrdinalIgnoreCase
            );
            if (markerIndex < 0)
            {
                return PublicImageCategory.Blog;
            }

            var relativePath = Uri.UnescapeDataString(
                    urlPath[(markerIndex + PublicRequestPath.Length + 1)..]
                )
                .Trim('/');
            var firstSeparator = relativePath.IndexOf('/');

            // URLs such as /Images/example.jpg belong to the legacy Blog folder
            if (firstSeparator < 0)
            {
                return PublicImageCategory.Blog;
            }

            var categoryName = relativePath[..firstSeparator];
            return TryParseKnownPublicCategory(categoryName, out var category)
                ? category
                : PublicImageCategory.Blog;
        }

        // Add the Blog segment to a stored URL created before category folders existed
        public static string? NormalizeLegacyPublicUrl(string? imageUrl)
        {
            if (string.IsNullOrWhiteSpace(imageUrl))
            {
                return imageUrl;
            }

            var marker = $"{PublicRequestPath}/";
            var markerIndex = imageUrl.IndexOf(
                marker,
                StringComparison.OrdinalIgnoreCase
            );
            if (markerIndex < 0)
            {
                return imageUrl;
            }

            var relativeStart = markerIndex + marker.Length;
            var relativeWithSuffix = imageUrl[relativeStart..];
            var suffixIndex = relativeWithSuffix.IndexOfAny(['?', '#']);
            var relativePath = suffixIndex >= 0
                ? relativeWithSuffix[..suffixIndex]
                : relativeWithSuffix;

            if (
                string.IsNullOrWhiteSpace(relativePath)
                || relativePath.Contains('/')
                || relativePath.Contains('\\')
            )
            {
                return imageUrl;
            }

            return imageUrl.Insert(relativeStart, "Blog/");
        }

        // Resolve a public filename inside its assigned category without path traversal
        public static bool TryGetPublicFilePath(
            string contentRootPath,
            PublicImageCategory category,
            string? fileName,
            out string filePath
        )
        {
            return TryGetFilePathWithinDirectory(
                GetPublicDirectory(contentRootPath, category),
                fileName,
                out filePath
            );
        }

        // Resolve a private filename without allowing directory traversal
        public static bool TryGetPrivateFilePath(
            string contentRootPath,
            string? fileName,
            out string filePath
        )
        {
            return TryGetFilePathWithinDirectory(
                GetPrivateDirectory(contentRootPath),
                fileName,
                out filePath
            );
        }

        // Resolve a simple filename while proving the result remains under its root
        private static bool TryGetFilePathWithinDirectory(
            string directoryPath,
            string? fileName,
            out string filePath
        )
        {
            filePath = string.Empty;
            if (
                string.IsNullOrWhiteSpace(fileName)
                || !string.Equals(
                    Path.GetFileName(fileName),
                    fileName,
                    StringComparison.Ordinal
                )
            )
            {
                return false;
            }

            var directoryRoot = Path.GetFullPath(directoryPath);
            var resolvedPath = Path.GetFullPath(Path.Combine(directoryRoot, fileName));
            var directoryRootPrefix = directoryRoot.EndsWith(
                Path.DirectorySeparatorChar
            )
                ? directoryRoot
                : $"{directoryRoot}{Path.DirectorySeparatorChar}";

            if (
                !resolvedPath.StartsWith(
                    directoryRootPrefix,
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                return false;
            }

            filePath = resolvedPath;
            return true;
        }

        // Map an enum value to the exact case-sensitive directory name used on Linux
        private static string GetCategoryDirectoryName(PublicImageCategory category)
        {
            return category switch
            {
                PublicImageCategory.Blog => "Blog",
                PublicImageCategory.CoverPage => "CoverPage",
                PublicImageCategory.AboutPage => "AboutPage",
                _ => throw new ArgumentOutOfRangeException(nameof(category))
            };
        }

        // Parse only an explicit category name without applying the legacy Blog default
        private static bool TryParseKnownPublicCategory(
            string value,
            out PublicImageCategory category
        )
        {
            category = default;
            return !int.TryParse(value, out _)
                && Enum.TryParse(value, true, out category)
                && Enum.IsDefined(category);
        }

        // Move legacy files without overwriting any file already present in the new layout
        private static void MigrateLegacyFiles(string contentRootPath)
        {
            var imagesRoot = Path.Combine(contentRootPath, ImagesDirectoryName);
            var blogDirectory = GetPublicDirectory(
                contentRootPath,
                PublicImageCategory.Blog
            );

            foreach (var legacyFilePath in Directory.EnumerateFiles(imagesRoot))
            {
                MoveLegacyFileIfDestinationIsAvailable(
                    legacyFilePath,
                    Path.Combine(blogDirectory, Path.GetFileName(legacyFilePath))
                );
            }

            var legacyProfilePicturesDirectory = Path.Combine(
                imagesRoot,
                ProfilePicturesDirectoryName
            );
            if (!Directory.Exists(legacyProfilePicturesDirectory))
            {
                return;
            }

            var profilePicturesDirectory = GetProfilePicturesDirectory(contentRootPath);
            foreach (
                var legacyFilePath in Directory.EnumerateFiles(
                    legacyProfilePicturesDirectory
                )
            )
            {
                MoveLegacyFileIfDestinationIsAvailable(
                    legacyFilePath,
                    Path.Combine(
                        profilePicturesDirectory,
                        Path.GetFileName(legacyFilePath)
                    )
                );
            }
        }

        // Preserve both files when a destination name is already occupied
        private static void MoveLegacyFileIfDestinationIsAvailable(
            string sourcePath,
            string destinationPath
        )
        {
            if (!File.Exists(destinationPath))
            {
                File.Move(sourcePath, destinationPath);
            }
        }
    }
}
