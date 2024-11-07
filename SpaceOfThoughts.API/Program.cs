using System.IO.Compression;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Repositories.Implementation;
using SpaceOfThoughts.API.Repositories.Interface;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Implement response compression
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true; // Enable compression for HTTPS requests
    options.Providers.Add<BrotliCompressionProvider>(); // Add Brotli compression provider
    options.Providers.Add<GzipCompressionProvider>(); // Add Gzip compression provider
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest; // Set Brotli compression level to fastest
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.SmallestSize; // Set Gzip compression level to smallest size
});

// Inject DbContext service to the builder and pass the connection string
var connectionString = builder.Configuration.GetConnectionString("SpaceOfThoughtsConnectionString");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)) // Use MySQL with auto-detected server version
);

builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)) // Use MySQL with auto-detected server version
);

// Register repositories for dependency injection
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IBlogPostRepository, BlogPostRepository>();
builder.Services.AddScoped<IImageRepository, ImageRepository>();
builder.Services.AddScoped<ITokenRepository, TokenRepository>();

// Configure Identity services
builder
    .Services.AddIdentityCore<IdentityUser>()
    .AddRoles<IdentityRole>()
    .AddTokenProvider<DataProtectorTokenProvider<IdentityUser>>("SpaceOfThoughts")
    .AddEntityFrameworkStores<AuthDbContext>()
    .AddDefaultTokenProviders();

//// Configure Data Protection to persist keys
//builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(@"/var/mykeys")); // Update this path accordingly, consider additional security measures for the keys

// Password requirements
builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequireDigit = false; // Do not require a digit in passwords
    options.Password.RequireLowercase = false; // Do not require a lowercase letter in passwords
    options.Password.RequireUppercase = false; // Do not require an uppercase letter in passwords
    options.Password.RequireNonAlphanumeric = true; // Require a non-alphanumeric character in passwords
    options.Password.RequiredLength = 7; // Set minimum password length to 7
    options.Password.RequiredUniqueChars = 3; // Require at least 3 unique characters in passwords
});

// Configure JWT authentication
builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtKey = builder.Configuration["Jwt:Key"];
        var jwtIssuer = builder.Configuration["Jwt:Issuer"];
        var jwtAudience = builder.Configuration["Jwt:Audience"];

        // Check for possible null values
        if (
            string.IsNullOrEmpty(jwtKey)
            || string.IsNullOrEmpty(jwtIssuer)
            || string.IsNullOrEmpty(jwtAudience)
        )
        {
            throw new InvalidOperationException("JWT configuration values are missing");
        }

        options.TokenValidationParameters = new TokenValidationParameters
        {
            AuthenticationType = "Jwt",
            ValidateIssuer = true, // Validate the issuer of the token
            ValidateAudience = true, // Validate the audience of the token
            ValidateLifetime = true, // Validate the token's expiration
            ValidateIssuerSigningKey = true, // Validate the signing key
            ValidIssuer = jwtIssuer, // Set the valid issuer
            ValidAudience = jwtAudience, // Set the valid audience
            IssuerSigningKey = new SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(jwtKey) // Set the signing key
            )
        };
    });

// Add rate limiting to protect the API from abuse
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: "global",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100, // Allow 100 requests per window
                Window = TimeSpan.FromMinutes(1) // Set the window duration to 1 minute
            }
        );
    });
});

// Define the CORS policy restrict api access to https://spaceofthoughts.com and http://localhost:4200
builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "AllowSpecificOrigins",
        builder =>
        {
            builder
                .WithOrigins("http://localhost:4200", "https://spaceofthoughts.com") // while "http://localhost:4200" is only for testing
                .AllowAnyMethod()
                .AllowAnyHeader();
        }
    );
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// HTTPS redirection will not be used because the API will run locally
app.UseHttpsRedirection();

// Apply the CORS policy
app.UseCors("AllowSpecificOrigins");

app.UseAuthentication();
app.UseAuthorization();

app.UseStaticFiles(
    new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(
            Path.Combine(Directory.GetCurrentDirectory(), "Images") // Serve static files from the "Images" directory
        ),
        RequestPath = "/Images" // Set the request path for static files
    }
);

// Add security headers to responses
app.Use(
    async (context, next) =>
    {
        context.Response.Headers.Append("X-Content-Type-Options", "nosniff"); // Prevent MIME type sniffing
        context.Response.Headers.Append("X-Frame-Options", "DENY"); // Prevent clickjacking
        context.Response.Headers.Append("X-XSS-Protection", "1; mode=block"); // Enable XSS protection
        await next();
    }
);

app.MapControllers();

app.UseResponseCompression(); // Enable response compression

app.Run();
