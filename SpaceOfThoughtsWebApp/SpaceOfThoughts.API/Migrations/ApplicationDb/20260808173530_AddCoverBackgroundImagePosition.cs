using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpaceOfThoughts.API.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddCoverBackgroundImagePosition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BackgroundImagePosition",
                table: "CoverPages",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BackgroundImagePosition",
                table: "CoverPages");
        }
    }
}
