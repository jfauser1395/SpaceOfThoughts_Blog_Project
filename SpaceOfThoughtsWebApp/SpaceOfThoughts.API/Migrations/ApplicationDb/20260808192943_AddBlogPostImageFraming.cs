using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpaceOfThoughts.API.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddBlogPostImageFraming : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FeaturedImageBannerPosition",
                table: "BlogPosts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FeaturedImageCardPosition",
                table: "BlogPosts",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FeaturedImageBannerPosition",
                table: "BlogPosts");

            migrationBuilder.DropColumn(
                name: "FeaturedImageCardPosition",
                table: "BlogPosts");
        }
    }
}
