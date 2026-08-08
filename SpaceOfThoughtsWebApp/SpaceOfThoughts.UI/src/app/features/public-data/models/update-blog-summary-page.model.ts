// Interface for updating blogs summary page settings
export interface UpdateBlogSummaryPage {
  // Optional background image URL for the blogs summary page
  backgroundImageUrl?: string | null;
  // Saved "x% y% zoom%" framing applied to the background picture
  backgroundImagePosition?: string | null;
}
