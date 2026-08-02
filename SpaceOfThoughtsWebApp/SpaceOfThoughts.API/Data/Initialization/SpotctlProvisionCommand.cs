namespace SpaceOfThoughts.API.Data.Initialization;

// Represents spotctl's explicit one-shot provisioning request. Its presence tells
// Program.cs to migrate/provision the administrator and exit instead of starting Kestrel.
public sealed record SpotctlProvisionCommand(string UserName, string Email)
{
    private const string CommandFlag = "--spotctl-provision-admin";
    private const string UserNameFlag = "--username";
    private const string EmailFlag = "--email";

    public static SpotctlProvisionCommand? Parse(string[] args, out string[] remainingArgs)
    {
        // An ordinary service start has no provisioning flag, so preserve every
        // argument for ASP.NET and let Program.cs follow its normal server path.
        if (!args.Contains(CommandFlag, StringComparer.Ordinal))
        {
            remainingArgs = args;
            return null;
        }

        string? userName = null;
        string? email = null;
        var commandCount = 0;
        var remaining = new List<string>();

        // Consume only spotctl-owned options. Unrelated arguments are retained for
        // WebApplication.CreateBuilder, which may still need standard ASP.NET options.
        for (var index = 0; index < args.Length; index++)
        {
            var argument = args[index];

            if (string.Equals(argument, CommandFlag, StringComparison.Ordinal))
            {
                commandCount++;
                continue;
            }

            if (string.Equals(argument, UserNameFlag, StringComparison.Ordinal))
            {
                userName = ReadSingleOptionValue(args, ref index, UserNameFlag, userName);
                continue;
            }

            if (string.Equals(argument, EmailFlag, StringComparison.Ordinal))
            {
                email = ReadSingleOptionValue(args, ref index, EmailFlag, email);
                continue;
            }

            remaining.Add(argument);
        }

        // Reject ambiguous invocations before any migration or administrator change runs.
        if (commandCount != 1)
        {
            throw new ArgumentException($"Specify {CommandFlag} exactly once.");
        }

        if (string.IsNullOrWhiteSpace(userName))
        {
            throw new ArgumentException($"{UserNameFlag} requires a non-empty value.");
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException($"{EmailFlag} requires a non-empty value.");
        }

        remainingArgs = remaining.ToArray();
        return new SpotctlProvisionCommand(userName.Trim(), email.Trim());
    }

    private static string ReadSingleOptionValue(
        string[] args,
        ref int index,
        string option,
        string? existingValue
    )
    {
        // Provisioning options must be single-valued so spotctl cannot accidentally
        // request two different administrator identities in one invocation.
        if (existingValue is not null)
        {
            throw new ArgumentException($"Specify {option} only once.");
        }

        if (index + 1 >= args.Length)
        {
            throw new ArgumentException($"{option} requires a value.");
        }

        // Advance past the value here so the outer parsing loop does not process it again.
        index++;
        return args[index];
    }
}
