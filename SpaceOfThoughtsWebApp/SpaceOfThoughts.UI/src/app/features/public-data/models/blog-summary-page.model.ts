// Interface representing settings for the public blogs summary page
export interface BlogSummaryPage {
  // Unique identifier for the blogs summary page settings
  id: string;

  // Optional background image URL for the blogs summary page
  backgroundImageUrl?: string | null;

  // Date and time when the blogs summary page was last updated
  updatedAt: string;
}
