namespace SpaceOfThoughts.API.Models.Domain
{
    // AboutPage represents the editable public about page content
    public class AboutPage
    {
        // Unique identifier for the about page
        public Guid Id { get; set; }

        // Display name of the author
        public required string AuthorName { get; set; }

        // Short role or title shown near the author name
        public required string AuthorRole { get; set; }

        // Caption shown near the signature graphic
        public required string SignatureCaption { get; set; }

        // Optional profile image URL for the author section
        public string? ProfileImageUrl { get; set; }

        // Saved "x% y% zoom%" framing applied when the profile picture is cropped
        // into its square on the public page. Null keeps the centred rendering.
        public string? ProfileImagePosition { get; set; }

        // Main introductory text about the author
        public required string AuthorIntro { get; set; }

        // Personal note shown beside the author introduction
        public required string AuthorAside { get; set; }

        // Overview text describing the blog
        public required string BlogOverview { get; set; }

        // Text describing the intended blog audience
        public required string BlogAudience { get; set; }

        // Text describing what makes the blog distinct
        public required string BlogDifference { get; set; }

        // Introductory text for community terms
        public required string CommunityIntro { get; set; }

        // Guideline for respectful discussion
        public required string RespectGuideline { get; set; }

        // Guideline for staying on topic
        public required string TopicGuideline { get; set; }

        // Guideline for spam and self-promotion
        public required string SpamGuideline { get; set; }

        // Guideline explaining moderation expectations
        public required string ModerationGuideline { get; set; }

        // Guideline explaining user agreement to the terms
        public required string AgreementGuideline { get; set; }

        // Consequences text for community rule violations
        public required string Consequences { get; set; }

        // Contact email displayed on the about page
        public required string ContactEmail { get; set; }

        // Date and time when the about page was last updated
        public DateTime UpdatedAt { get; set; }
    }
}
