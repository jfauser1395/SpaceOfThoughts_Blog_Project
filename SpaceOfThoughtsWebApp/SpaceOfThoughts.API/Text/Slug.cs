using System.Globalization;
using System.Text;

namespace SpaceOfThoughts.API.Text
{
    // Builds the lowercase hyphenated strings used for public URL handles and for
    // stored image filenames. These were administrator-entered free text before,
    // so a stray capital or trailing space produced a link nobody could type.
    public static class Slug
    {
        // Used when a title reduces to nothing, such as one written entirely in
        // punctuation or in a script this transliteration cannot map to ASCII.
        public const string Fallback = "untitled";

        // Convert any title into a slug safe for a URL segment and a filename
        public static string Create(string? source)
        {
            if (string.IsNullOrWhiteSpace(source))
            {
                return Fallback;
            }

            var decomposed = ExpandGermanCharacters(source).Normalize(NormalizationForm.FormD);
            var slug = new StringBuilder(decomposed.Length);

            foreach (var character in decomposed)
            {
                // Dropping the accents left behind by decomposition keeps "café" as "cafe"
                if (
                    CharUnicodeInfo.GetUnicodeCategory(character)
                    == UnicodeCategory.NonSpacingMark
                )
                {
                    continue;
                }

                if (char.IsAsciiLetterOrDigit(character))
                {
                    slug.Append(char.ToLowerInvariant(character));
                }
                else if (slug.Length > 0 && slug[^1] != '-')
                {
                    // Every other run, spaces and punctuation alike, collapses to one hyphen
                    slug.Append('-');
                }
            }

            var result = slug.ToString().TrimEnd('-');
            return result.Length == 0 ? Fallback : result;
        }

        // Umlauts have established two-letter spellings that read better than the
        // bare vowels Unicode decomposition would otherwise leave behind.
        private static string ExpandGermanCharacters(string source)
        {
            return source
                .Replace("ä", "ae", StringComparison.OrdinalIgnoreCase)
                .Replace("ö", "oe", StringComparison.OrdinalIgnoreCase)
                .Replace("ü", "ue", StringComparison.OrdinalIgnoreCase)
                .Replace("ß", "ss", StringComparison.OrdinalIgnoreCase);
        }
    }
}
