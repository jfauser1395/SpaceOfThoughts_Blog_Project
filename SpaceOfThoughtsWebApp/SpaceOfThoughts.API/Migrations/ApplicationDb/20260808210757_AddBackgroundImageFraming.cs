using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpaceOfThoughts.API.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddBackgroundImageFraming : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BackgroundImagePosition",
                table: "BlogSummaryPages",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundImagePosition",
                table: "BlogPosts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundImageUrl",
                table: "BlogPosts",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BackgroundImagePosition",
                table: "BlogSummaryPages");

            migrationBuilder.DropColumn(
                name: "BackgroundImagePosition",
                table: "BlogPosts");

            migrationBuilder.DropColumn(
                name: "BackgroundImageUrl",
                table: "BlogPosts");
        }
    }
}
