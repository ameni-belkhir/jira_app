using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.IO;
using Microsoft.AspNetCore.Http;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Domain.Entity;
using Application.DTO;
using Application.Interfaces;

using Microsoft.AspNetCore.Authorization;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IFileStorageService _fileStorage;

        public UsersController(ApplicationDbContext db, IFileStorageService fileStorage)
        {
            _db = db;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Application.DTO.UserDto>>> Get()
        {
            var items = await _db.Users.AsNoTracking().ToListAsync();
            var dtos = items.Select(u => new Application.DTO.UserDto
            {
                Id = u.Id,
                Nom = u.Nom,
                Prenom = u.Prenom,
                Email = u.Email,
                ProfileImageUrl = u.ProfileImageUrl
            });
            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Application.DTO.UserDto>> GetById(int id)
        {
            var item = await _db.Users.FindAsync(id);
            if (item == null) return NotFound();
            var dto = new Application.DTO.UserDto
            {
                Id = item.Id,
                Nom = item.Nom,
                Prenom = item.Prenom,
                Email = item.Email,
                ProfileImageUrl = item.ProfileImageUrl
            };
            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<Application.DTO.UserDto>> Create([FromBody] CreateUserDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var user = new User
            {
                Nom = dto.Nom,
                Prenom = dto.Prenom,
                Email = dto.Email,
                Password = dto.Password,
                RoleId = dto.RoleId
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            var result = new Application.DTO.UserDto
            {
                Id = user.Id,
                Nom = user.Nom,
                Prenom = user.Prenom,
                Email = user.Email
            };
            result.ProfileImageUrl = user.ProfileImageUrl;
            return CreatedAtAction(nameof(GetById), new { id = user.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateProfileDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.Nom = dto.Nom;
            user.Prenom = dto.Prenom;

            _db.Users.Update(user);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("upload-profile-picture")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadProfilePicture([FromForm] Application.DTO.UploadProfileImageDto dto)
        {
            var file = dto?.File;
            if (file == null || file.Length == 0) return BadRequest("Veuillez fournir un fichier valide.");

            // Validate size (max 5 MB)
            const long maxBytes = 5 * 1024 * 1024;
            if (file.Length > maxBytes) return BadRequest($"Fichier trop volumineux ({file.Length / 1024 / 1024} Mo). Max 5 Mo.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            if (!allowed.Contains(ext)) return BadRequest("Type de fichier invalide. Autorisé : .jpg, .jpeg, .png, .webp");

            // Get current user id from claims
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var user = await _db.Users.FindAsync(userId);
            if (user == null) return NotFound();

            var relativeUrl = await _fileStorage.SaveProfileImageAsync(file);
            user.ProfileImageUrl = relativeUrl;
            _db.Users.Update(user);
            await _db.SaveChangesAsync();

            return Ok(new { profileImageUrl = relativeUrl });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _db.Users.FindAsync(id);
            if (item == null) return NotFound();
            _db.Users.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
