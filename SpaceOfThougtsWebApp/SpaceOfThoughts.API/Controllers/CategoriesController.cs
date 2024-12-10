using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Controllers
{
    // The CategoriesController handles CRUD operations for categories
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriesController : ControllerBase
    {
        private readonly ICategoryRepository categoryRepository;

        public CategoriesController(ICategoryRepository categoryRepository)
        {
            this.categoryRepository = categoryRepository;
        }

        // POST: {apiBaseUrl}/api/categories - Endpoint to create a new category
        [HttpPost]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequestDto request)
        {
            // Convert DTO to Domain Model
            var category = new Category 
            { 
                Name = request.Name,
                UrlHandle = request.UrlHandle
            };

            // Save the new category to the repository
            category = await categoryRepository.CreateAsync(category);

            // Convert Domain Model to DTO
            var response = new CategoryDto
            {
                Id = category.Id,
                Name = request.Name,
                UrlHandle = request.UrlHandle
            };
            return Ok(response);
        }

        // GET: {apiBaseUrl}/api/Categories?query=example&sortBy=example1&sortDirection=desc - Endpoint to get all categories with optional query, sorting, and pagination
        [HttpGet]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> GetAllCategories(
            [FromQuery] string? query,
            [FromQuery] string? sortBy,
            [FromQuery] string? sortDirection,
            [FromQuery] int? pageNumber,
            [FromQuery] int? pageSize
        )
        {
            // Call repository to get all categories with optional query, sorting, and pagination
            var categories = await categoryRepository.GetAllAsync(
                query,
                sortBy,
                sortDirection,
                pageNumber,
                pageSize
            );

            // Convert Domain Models to DTOs
            var response = new List<CategoryDto>();
            foreach (var category in categories)
            {
                response.Add(
                    new CategoryDto
                    {
                        Id = category.Id,
                        Name = category.Name,
                        UrlHandle = category.UrlHandle
                    }
                );
            }
            return Ok(response);
        }

        // GET: {apiBaseUrl}/api/Categories/{id} - Endpoint to get a category by its ID
        [HttpGet]
        [Route("{id:Guid}")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> GetCategoryById([FromRoute] Guid id)
        {
            // Call repository to get the category by its ID
            var existentCategory = await categoryRepository.GetById(id);
            if (existentCategory is null)
            {
                return NotFound();
            }

            // Convert Domain Model to DTO
            var response = new CategoryDto
            {
                Id = existentCategory.Id,
                Name = existentCategory.Name,
                UrlHandle = existentCategory.UrlHandle
            };
            return Ok(response);
        }

        // GET: {apiBaseUrl}/api/Categories/count - Endpoint to get the total count of categories
        [HttpGet]
        [Route("count")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> GetCategoriesTotal()
        {
            // Call repository to get the total count of categories
            var count = await categoryRepository.GetCount();
            return Ok(count);
        }

        // PUT: {apiBaseUrl}/api/categories/{id} - Endpoint to update a category by its ID
        [HttpPut]
        [Route("{id:Guid}")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> EditCategory(
            [FromRoute] Guid id,
            [FromBody] UpdateCategoryRequestDto request
        )
        {
            // Convert DTO to Domain Model
            var category = new Category
            {
                Id = id,
                Name = request.Name,
                UrlHandle = request.UrlHandle
            };

            // Update the category in the repository
            category = await categoryRepository.UpdateAsync(category);
            if (category is null)
            {
                return NotFound();
            }

            // Convert Domain Model to DTO
            var response = new CategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                UrlHandle = category.UrlHandle
            };
            return Ok(response);
        }

        // DELETE: {apiBaseUrl}/api/categories/{id} - Endpoint to delete a category by its ID
        [HttpDelete]
        [Route("{id:guid}")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> DeleteCategory([FromRoute] Guid id)
        {
            // Call repository to delete the category by its ID
            var deletedCategory = await categoryRepository.DeleteAsync(id);
            if (deletedCategory is null)
            {
                return NotFound();
            }

            // Convert Domain Model to DTO
            var response = new CategoryDto
            {
                Id = deletedCategory.Id,
                Name = deletedCategory.Name,
                UrlHandle = deletedCategory.UrlHandle
            };
            return Ok(response);
        }
    }
}
