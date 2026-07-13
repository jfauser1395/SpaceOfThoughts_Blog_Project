// Interface representing the public cover page content
export interface CoverPage {
  // Unique identifier for the cover page
  id: string;

  // Main welcome title displayed on the cover page
  welcomeTitle: string;

  // Introductory text displayed below the welcome title
  introduction: string;

  // Optional background image URL for the cover page
  backgroundImageUrl?: string | null;

  // Date and time when the cover page was last updated
  updatedAt: string;
}
