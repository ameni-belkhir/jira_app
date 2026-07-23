using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Domain.Entity;
using Application.DTO;

using Microsoft.AspNetCore.Authorization;
namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class ProjectsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public ProjectsController(ApplicationDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProjectDto>>> Get()
        {
            var items = await _db.Projects.Include(p => p.Members).AsNoTracking().ToListAsync();
            var dtos = items.Select(p => new ProjectDto
            {
                Id = p.Id,
                Nom = p.Nom,
                Responsable = p.Responsable,
                Description = p.Description,
                MemberIds = p.Members?.Select(m => m.Id).ToList() ?? new List<int>()
            });
            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ProjectDto>> GetById(int id)
        {
            var item = await _db.Projects.Include(p => p.Members).FirstOrDefaultAsync(p => p.Id == id);
            if (item == null) return NotFound();
            var dto = new ProjectDto
            {
                Id = item.Id,
                Nom = item.Nom,
                Responsable = item.Responsable,
                Description = item.Description,
                MemberIds = item.Members?.Select(m => m.Id).ToList() ?? new List<int>()
            };
            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<ProjectDto>> Create([FromBody] CreateProjectDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var project = new Project
            {
                Nom = dto.Nom,
                Responsable = dto.Responsable,
                Description = dto.Description
            };

            if (dto.MemberIds?.Any() == true)
            {
                var users = await _db.Users.Where(u => dto.MemberIds.Contains(u.Id)).ToListAsync();
                foreach (var u in users) project.Members.Add(u);
            }

            _db.Projects.Add(project);
            await _db.SaveChangesAsync();

            var result = new ProjectDto
            {
                Id = project.Id,
                Nom = project.Nom,
                Responsable = project.Responsable,
                Description = project.Description,
                MemberIds = project.Members.Select(m => m.Id).ToList()
            };

            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateProjectDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (id != dto.Id) return BadRequest();
            var project = await _db.Projects.Include(p => p.Members).FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound();
            project.Nom = dto.Nom;
            project.Responsable = dto.Responsable;
            project.Description = dto.Description;

            // Update members
            project.Members.Clear();
            if (dto.MemberIds?.Any() == true)
            {
                var users = await _db.Users.Where(u => dto.MemberIds.Contains(u.Id)).ToListAsync();
                foreach (var u in users) project.Members.Add(u);
            }

            _db.Projects.Update(project);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _db.Projects.FindAsync(id);
            if (item == null) return NotFound();
            _db.Projects.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
