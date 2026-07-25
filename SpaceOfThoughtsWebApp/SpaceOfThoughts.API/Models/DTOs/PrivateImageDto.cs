namespace SpaceOfThoughts.API.Models.DTOs
{
    // Describe a private image without exposing its physical server path
    public class PrivateImageDto
    {
        public required string FileName { get; set; }
        public required string Url { get; set; }
        public required string ContentType { get; set; }
        public long SizeInBytes { get; set; }
        public DateTimeOffset LastModifiedAt { get; set; }
    }
}
