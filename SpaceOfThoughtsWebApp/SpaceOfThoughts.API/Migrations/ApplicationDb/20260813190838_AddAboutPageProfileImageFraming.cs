using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpaceOfThoughts.API.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddAboutPageProfileImageFraming : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProfileImagePosition",
                table: "AboutPages",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProfileImagePosition",
                table: "AboutPages");
        }
    }
}
