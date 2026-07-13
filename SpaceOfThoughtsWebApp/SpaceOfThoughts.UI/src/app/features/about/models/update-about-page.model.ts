// Interface for updating the editable about page content
export interface UpdateAboutPage {
  // Display name of the author
  authorName: string;

  // Short role or title shown near the author name
  authorRole: string;

  // Caption shown near the signature graphic
  signatureCaption: string;

  // Optional profile image URL for the author section
  profileImageUrl?: string | null;

  // Main introductory text about the author
  authorIntro: string;

  // Personal note shown beside the author introduction
  authorAside: string;

  // Overview text describing the blog
  blogOverview: string;

  // Text describing the intended blog audience
  blogAudience: string;

  // Text describing what makes the blog distinct
  blogDifference: string;

  // Introductory text for community terms
  communityIntro: string;

  // Guideline for respectful discussion
  respectGuideline: string;

  // Guideline for staying on topic
  topicGuideline: string;

  // Guideline for spam and self-promotion
  spamGuideline: string;

  // Guideline explaining moderation expectations
  moderationGuideline: string;

  // Guideline explaining user agreement to the terms
  agreementGuideline: string;

  // Consequences text for community rule violations
  consequences: string;

  // Contact email displayed on the about page
  contactEmail: string;
}
