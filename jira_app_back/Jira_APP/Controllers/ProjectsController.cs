using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
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
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var isAdmin = User.IsInRole("Admin");
            var isGlobalScrumMaster = User.IsInRole("ScrumMaster");

            IQueryable<Project> query = _db.Projects
                .Include(p => p.Members).ThenInclude(pm => pm.User)
                .AsNoTracking();

            if (!isAdmin)
            {
                if (isGlobalScrumMaster)
                {
                    // ScrumMaster: projets créés par lui OU dont il est membre
                    query = query.Where(p =>
                        p.CreatedById == userId ||
                        p.Members.Any(pm => pm.UserId == userId));
                }
                else
                {
                    // Senior/Developer: uniquement les projets où il est membre
                    query = query.Where(p => p.Members.Any(pm => pm.UserId == userId));
                }
            }

            var items = await query.ToListAsync();
            var dtos = items.Select(p => MapToDto(p));
            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ProjectDto>> GetById(int id)
        {
            var item = await _db.Projects
                .Include(p => p.Members).ThenInclude(pm => pm.User)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (item == null) return NotFound();
            return Ok(MapToDto(item));
        }

        [HttpPost]
        public async Task<ActionResult<ProjectDto>> Create([FromBody] CreateProjectDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var creatorId))
                return Unauthorized("Utilisateur non identifié dans le token.");

            var project = new Project
            {
                Nom = dto.Nom,
                Responsable = dto.Responsable,
                Description = dto.Description,
                CreatedById = creatorId
            };

            // Le créateur devient automatiquement ScrumMaster du projet
            project.Members.Add(new ProjectMember
            {
                UserId = creatorId,
                RoleInProject = "ScrumMaster",
                JoinedAt = DateTime.UtcNow
            });

            // Chaque ScrumMaster sélectionné est ajouté comme membre ScrumMaster
            var scrumMasterIds = (dto.ScrumMasterIds ?? new List<int>())
                .Distinct()
                .Where(id => id != creatorId)
                .ToList();

            foreach (var scrumMasterId in scrumMasterIds)
            {
                project.Members.Add(new ProjectMember
                {
                    UserId = scrumMasterId,
                    RoleInProject = "ScrumMaster",
                    JoinedAt = DateTime.UtcNow
                });
            }

            _db.Projects.Add(project);
            await _db.SaveChangesAsync();

            // Recharge avec les navigations pour le DTO de retour
            await _db.Entry(project).Collection(p => p.Members).Query().Include(pm => pm.User).LoadAsync();

            return CreatedAtAction(nameof(GetById), new { id = project.Id }, MapToDto(project));
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateProjectDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (id != dto.Id) return BadRequest();

            var project = await _db.Projects.FindAsync(id);
            if (project == null) return NotFound();

            project.Nom = dto.Nom;
            project.Responsable = dto.Responsable;
            project.Description = dto.Description;

            _db.Projects.Update(project);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var project = await _db.Projects
                    .Include(p => p.Sprints)
                    .Include(p => p.Members)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (project == null) return NotFound();

                await using var transaction = await _db.Database.BeginTransactionAsync();

                // 1. Supprimer les tickets associés aux sprints du projet et au backlog (y compris les sous-tickets)
                var sprintIds = project.Sprints.Select(s => s.Id).ToList();
                var tickets = await _db.Tickets
                    .Where(t => t.ProjectId == id || (t.SprintId.HasValue && sprintIds.Contains(t.SprintId.Value)))
                    .ToListAsync();

                // Suppression feuille d'abord pour respecter la contrainte self-referencing Restrict (sous-tickets)
                var remaining = tickets;
                while (remaining.Count > 0)
                {
                    var remainingIds = remaining.Select(t => t.Id).ToHashSet();
                    var referencedParentIds = remaining
                        .Where(t => t.ParentTicketId.HasValue && remainingIds.Contains(t.ParentTicketId.Value))
                        .Select(t => t.ParentTicketId!.Value)
                        .ToHashSet();

                    var leaves = remaining.Where(t => !referencedParentIds.Contains(t.Id)).ToList();
                    if (leaves.Count == 0) break;

                    _db.Tickets.RemoveRange(leaves);
                    await _db.SaveChangesAsync();
                    remaining = remaining.Where(t => !leaves.Contains(t)).ToList();
                }

                // 2. Supprimer les membres du projet
                if (project.Members.Any())
                {
                    _db.ProjectMembers.RemoveRange(project.Members);
                }

                // 3. Supprimer les sprints
                if (project.Sprints.Any())
                {
                    _db.Sprints.RemoveRange(project.Sprints);
                }

                // 4. Supprimer le projet
                _db.Projects.Remove(project);

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return NoContent();
            }
            catch (DbUpdateException ex)
            {
                return BadRequest(new { message = $"Suppression du projet impossible : {ex.InnerException?.Message ?? ex.Message}" });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = ex.Message });
            }
        }

        private static ProjectDto MapToDto(Project project) => new ProjectDto
        {
            Id = project.Id,
            Nom = project.Nom,
            Responsable = project.Responsable,
            Description = project.Description,
            CreatedById = project.CreatedById,
            Members = project.Members?.Select(m => new ProjectMemberSummaryDto
            {
                UserId = m.UserId,
                Nom = m.User?.Nom ?? "",
                Prenom = m.User?.Prenom ?? "",
                RoleInProject = m.RoleInProject
            }).ToList() ?? new List<ProjectMemberSummaryDto>(),
            ScrumMasterIds = project.Members?
                .Where(m => m.RoleInProject == "ScrumMaster")
                .Select(m => m.UserId)
                .ToList() ?? new List<int>()
        };
    }
}
