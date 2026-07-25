namespace SpaceOfThoughts.API.Authentication
{
    public static class JwtCookieDefaults
    {
        public const string Name = "Authorization";
        public static readonly TimeSpan Lifetime = TimeSpan.FromHours(3);
    }
}
