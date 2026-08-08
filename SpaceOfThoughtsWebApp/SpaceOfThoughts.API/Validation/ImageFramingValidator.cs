using System.Globalization;
using System.Text.RegularExpressions;

namespace SpaceOfThoughts.API.Validation
{
    // Shared validation for the "x% y% zoom%" framing strings the cover page and
    // blog post editors produce. The editors are the only writers of these values,
    // so the accepted shape is deliberately exact rather than forgiving.
    public static class ImageFramingValidator
    {
        private static readonly Regex Pattern = new(
            @"^(\d{1,3})% (\d{1,3})% (\d{1,3})%$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant
        );

        // Mirrors the zoom range offered by the editors' sliders. Below 100 percent
        // a picture would stop covering the frame it is cropped into.
        public const int MinimumZoom = 100;
        public const int MaximumZoom = 250;

        // Return null when the value is acceptable, otherwise the reason it is not.
        // An absent value is valid and restores the centred, unzoomed rendering.
        public static string? Validate(string? framing)
        {
            if (string.IsNullOrWhiteSpace(framing))
            {
                return null;
            }

            var match = Pattern.Match(framing.Trim());
            if (!match.Success)
            {
                return "Image framing must be formatted as \"50% 50% 100%\".";
            }

            var horizontal = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
            var vertical = int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture);
            var zoom = int.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture);

            if (horizontal > 100 || vertical > 100)
            {
                return "Image framing percentages must be between 0 and 100.";
            }

            if (zoom < MinimumZoom || zoom > MaximumZoom)
            {
                return $"Image framing zoom must be between {MinimumZoom} and {MaximumZoom} percent.";
            }

            return null;
        }
    }
}
