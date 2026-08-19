using Microsoft.Extensions.Options;
using Resend;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // Sends the verification emails through Resend
    public class ResendEmailServiceRepository(
        IResend resend,
        IOptions<EmailOptions> options,
        ILogger<ResendEmailServiceRepository> logger) : IEmailServiceRepository
    {
        public async Task<EmailResult> SendAsync(EmailRequest request, CancellationToken ct = default)
        {
            try
            {
                // Pick the template matching the flow
                var template = request.Purpose == CodePurpose.EmailVerification
                    ? options.Value.VerificationTemplateId
                    : options.Value.PasswordResetTemplateId;

                // Fill the placeholders of the published template
                var message = new EmailMessage
                {
                    To = request.ToAddress,
                    Template = new EmailMessageTemplate
                    {
                        TemplateId = template,
                        Variables = new Dictionary<string, object>
                        {
                            ["USER_NAME"] = request.UserName,
                            ["CODE"] = request.Code,
                            ["EXPIRY_MINUTES"] = request.ExpiresInMinutes
                        }
                    }
                };

                var result = await resend.EmailSendAsync(message, ct);

                logger.LogInformation(
                    "Sent {Purpose} email to {ToAddress}, id {Id}",
                    request.Purpose, request.ToAddress, result?.Content);

                return new EmailResult
                {
                    Success = true,
                    Id = result?.Content.ToString()
                };
            }
            catch (Exception ex)
            {
                // The caller only sees the failure, so keep the details here
                logger.LogError(
                    ex, "Failed to send {Purpose} email to {ToAddress}",
                    request.Purpose, request.ToAddress);

                return new EmailResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }
    }
}
