namespace SpaceOfThoughts.API.Imaging
{
    public enum ImageUploadPurpose
    {
        PublicLibrary,
        PrivateLibrary,
        ProfilePicture
    }

    public sealed record ProcessedImageFile(
        string FileName,
        string FilePath,
        string FileExtension,
        string ContentType,
        uint Width,
        uint Height,
        long SizeInBytes,
        bool IsLossless
    );

    public sealed class ImageUploadException : Exception
    {
        public ImageUploadException(string message)
            : base(message) { }

        public ImageUploadException(string message, Exception innerException)
            : base(message, innerException) { }
    }

    public interface IImageUploadProcessor
    {
        Task<ProcessedImageFile> ProcessAndStoreAsync(
            IFormFile file,
            string destinationDirectory,
            string outputBaseName,
            ImageUploadPurpose purpose,
            CancellationToken cancellationToken = default
        );
    }
}
