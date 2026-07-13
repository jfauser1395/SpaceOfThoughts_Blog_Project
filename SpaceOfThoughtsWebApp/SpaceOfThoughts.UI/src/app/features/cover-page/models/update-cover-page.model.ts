// Interface for updating the editable cover page content
export interface UpdateCoverPage {
  // Main welcome title displayed on the cover page
  welcomeTitle: string;

  // Introductory text displayed below the welcome title
  introduction: string;

  // Optional background image URL for the cover page
  backgroundImageUrl?: string | null;
}
