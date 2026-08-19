using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing the email subservice
    public interface IEmailServiceRepository
    {
        // Send a verification email and report whether the provider took it
        Task<EmailResult> SendAsync(EmailRequest request, CancellationToken ct);
    }
}
