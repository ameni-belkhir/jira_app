using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using System.Security.Cryptography;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize(Roles = "Admin", Policy = "AdminOnly")]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IEmailService _emailService;
        private readonly ILogger<AdminController> _logger;

        public AdminController(
            ApplicationDbContext db,
            IEmailService emailService,
            ILogger<AdminController> logger)
        {
            _db = db;
            _emailService = emailService;
            _logger = logger;
        }

        [HttpPost("fix-missing-permissions")]
        [Authorize(Roles = "Admin", Policy = "AdminOnly")]
        public async Task<IActionResult> FixMissingPermissions()
        {
            // CAS 1 : utilisateurs qui n'ont AUCUNE ligne UserPermission.
            // Réinitialisation complète via ResetUserPermissionsAsync : ils reçoivent
            // la liste par défaut de leur rôle, qui inclut déjà "profile" pour tous
            // les rôles (Admin, ScrumMaster, Senior, Developer).
            var usersWithoutPermissions = await _db.Users
                .Where(u => !_db.UserPermissions.Any(up => up.UserId == u.Id))
                .Include(u => u.Role)
                .ToListAsync();

            foreach (var user in usersWithoutPermissions)
            {
                await _db.ResetUserPermissionsAsync(user, user.Role.Description);
            }

            // CAS 2 : utilisateurs qui ont DÉJÀ des permissions, mais à qui il manque
            // spécifiquement la clé "profile" (créés avant l'ajout de cette clé, ou
            // désactivée manuellement). On ajoute/réactive UNIQUEMENT cette clé, SANS
            // réinitialiser le reste : on préserve les choix déjà faits par l'admin.
            var profileFixedCount = 0;

            var usersWithPermissionsMissingProfile = await _db.Users
                .Where(u => u.UserPermissions.Any())
                .Select(u => new
                {
                    User = u,
                    ProfilePermission = u.UserPermissions
                        .FirstOrDefault(up => up.InterfaceKey == InterfaceKeys.Profile)
                })
                .ToListAsync();

            foreach (var item in usersWithPermissionsMissingProfile)
            {
                if (item.ProfilePermission is null)
                {
                    _db.UserPermissions.Add(new UserPermission
                    {
                        UserId = item.User.Id,
                        InterfaceKey = InterfaceKeys.Profile,
                        IsEnabled = true
                    });
                    profileFixedCount++;
                }
                else if (!item.ProfilePermission.IsEnabled)
                {
                    item.ProfilePermission.IsEnabled = true;
                    profileFixedCount++;
                }
            }

            if (profileFixedCount > 0)
            {
                await _db.SaveChangesAsync();
            }

            return Ok(new
            {
                fixedCount = usersWithoutPermissions.Count,
                profileFixedCount
            });
        }

        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<AdminUserDto>>> GetUsers()
        {
            var users = await _db.Users
                .AsNoTracking()
                .Include(user => user.Role)
                .Select(user => new AdminUserDto
                {
                    Id = user.Id,
                    Nom = user.Nom,
                    Prenom = user.Prenom,
                    Email = user.Email,
                    RoleId = user.RoleId,
                    Role = user.Role.Description,
                    DateInscription = user.DateInscription,
                    IsEmailVerified = user.IsEmailVerified
                })
                .ToListAsync();

            return Ok(users);
        }

        [HttpPost("users")]
        public async Task<ActionResult<CreateUserResultDto>> CreateUser(
            [FromBody] CreateUserByAdminDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (await _db.Users.AnyAsync(user => user.Email == dto.Email))
            {
                return BadRequest(new { email = "Cette adresse e-mail est déjà utilisée." });
            }

            var role = await _db.Roles.FindAsync(dto.RoleId);
            if (role == null)
            {
                return BadRequest(new { roleId = "Rôle introuvable." });
            }

            var generatedPassword = GenerateSecurePassword();

            var user = new User
            {
                Nom = dto.Nom,
                Prenom = dto.Prenom,
                Email = dto.Email,
                RoleId = role.Id,
                IsEmailVerified = true,
                MustChangePassword = true
            };
            user.Password = new PasswordHasher<User>().HashPassword(user, generatedPassword);

            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            await _db.ResetUserPermissionsAsync(user, role.Description);

            var emailSent = false;
            try
            {
                var body = $@"<div style=""font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b"">
  <div style=""padding:28px;background:#f8fafc;border-radius:8px"">
    <h2 style=""margin:0 0 16px;color:#1e293b;font-size:20px"">Votre compte a été créé</h2>
    <p style=""margin:0 0 12px;line-height:1.6;color:#475569"">Bonjour {user.Prenom} {user.Nom},</p>
    <p style=""margin:0 0 12px;line-height:1.6;color:#475569"">Un administrateur a créé votre compte sur Jira App. Voici vos identifiants de connexion :</p>
    <div style=""margin:20px 0;padding:18px;background:#fff;border-radius:8px;border:1px solid #e2e8f0"">
      <p style=""margin:0 0 8px;color:#475569;font-size:14px""><strong>E-mail :</strong> {dto.Email}</p>
      <p style=""margin:0;color:#475569;font-size:14px""><strong>Mot de passe :</strong> <span style=""font-family:monospace;font-size:16px;color:#3b82f6;background:#f1f5f9;padding:2px 8px;border-radius:4px"">{generatedPassword}</span></p>
    </div>
    <p style=""margin:16px 0 0;line-height:1.6;color:#475569"">Nous vous invitons à vous connecter et à changer votre mot de passe dès votre première connexion.</p>
  </div>
  <div style=""padding:16px;text-align:center"">
    <p style=""margin:0;color:#94a3b8;font-size:12px;line-height:1.5"">Jira App — Gestion de projet simplifiée</p>
  </div>
</div>";

                await _emailService.SendEmailAsync(
                    user.Email,
                    "Votre compte a été créé",
                    body);
                emailSent = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to send account creation email to {Email}", user.Email);
            }

            var result = new CreateUserResultDto
            {
                Id = user.Id,
                Nom = user.Nom,
                Prenom = user.Prenom,
                Email = user.Email,
                RoleId = user.RoleId,
                Role = role.Description,
                DateInscription = user.DateInscription,
                IsEmailVerified = user.IsEmailVerified,
                EmailSent = emailSent
            };

            return Created($"/api/admin/users/{user.Id}", result);
        }

        [HttpGet("users/{id:int}/permissions")]
        public async Task<ActionResult<IEnumerable<UserPermissionDto>>> GetUserPermissions(int id)
        {
            var userExists = await _db.Users.AnyAsync(user => user.Id == id);
            if (!userExists) return NotFound();

            var permissions = await _db.UserPermissions
                .AsNoTracking()
                .Where(permission => permission.UserId == id)
                .ToDictionaryAsync(permission => permission.InterfaceKey, permission => permission.IsEnabled);

            var result = InterfaceKeys.All.Select(interfaceKey => new UserPermissionDto
            {
                InterfaceKey = interfaceKey,
                IsEnabled = permissions.TryGetValue(interfaceKey, out var isEnabled) && isEnabled
            });

            return Ok(result);
        }

        [HttpGet("users/{id:int}/role-change-impact")]
        public async Task<ActionResult<IEnumerable<RoleChangeImpactDto>>> GetRoleChangeImpact(
            int id,
            [FromQuery] int roleId)
        {
            if (!await _db.Users.AnyAsync(user => user.Id == id)) return NotFound();

            var role = await _db.Roles.FindAsync(roleId);
            if (role == null) return BadRequest(new { roleId = "Rôle introuvable." });

            // Projets où le user est membre AVEC un RoleInProject différent du
            // nouveau rôle global proposé. Liste vide si aucun écart.
            var impact = await _db.ProjectMembers
                .AsNoTracking()
                .Where(pm => pm.UserId == id && pm.RoleInProject != role.Description)
                .Select(pm => new RoleChangeImpactDto
                {
                    ProjectId = pm.ProjectId,
                    ProjectName = pm.Project.Nom,
                    CurrentRoleInProject = pm.RoleInProject
                })
                .ToListAsync();

            return Ok(impact);
        }

        [HttpPut("users/{id:int}/role")]
        public async Task<IActionResult> UpdateUserRole(int id, [FromBody] UpdateUserRoleDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();

            var role = await _db.Roles.FindAsync(dto.RoleId);
            if (role == null) return BadRequest(new { roleId = "Rôle introuvable." });

            user.RoleId = role.Id;

            // Alignement optionnel des RoleInProject sur le nouveau rôle global,
            // UNIQUEMENT sur les projets où l'admin a explicitement choisi
            // AlignToNewRole === true. Jamais d'alignement automatique en masse.
            if (dto.ProjectRoleDecisions != null && dto.ProjectRoleDecisions.Count > 0)
            {
                var requestedProjectIds = dto.ProjectRoleDecisions
                    .Select(decision => decision.ProjectId)
                    .Distinct()
                    .ToList();

                var memberships = await _db.ProjectMembers
                    .Where(pm => pm.UserId == id && requestedProjectIds.Contains(pm.ProjectId))
                    .ToListAsync();

                if (memberships.Count != requestedProjectIds.Count)
                {
                    return BadRequest(new
                    {
                        projectRoleDecisions = "Un ou plusieurs projets ne correspondent pas à un rôle projet existant pour cet utilisateur."
                    });
                }

                var alignByProject = dto.ProjectRoleDecisions
                    .Where(decision => decision.AlignToNewRole)
                    .Select(decision => decision.ProjectId)
                    .ToHashSet();

                foreach (var membership in memberships)
                {
                    if (alignByProject.Contains(membership.ProjectId))
                    {
                        membership.RoleInProject = role.Description;
                    }
                }
            }

            await _db.ResetUserPermissionsAsync(user, role.Description);

            return NoContent();
        }

        [HttpPut("users/{id:int}/permissions")]
        public async Task<IActionResult> UpdateUserPermissions(
            int id,
            [FromBody] UpdateUserPermissionsDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (!await _db.Users.AnyAsync(user => user.Id == id)) return NotFound();

            var requestedKeys = dto.Permissions.Select(permission => permission.InterfaceKey).ToList();
            if (requestedKeys.Distinct(StringComparer.Ordinal).Count() != requestedKeys.Count)
            {
                return BadRequest(new { permissions = "Chaque interface ne peut être fournie qu'une fois." });
            }

            var invalidKeys = requestedKeys
                .Where(key => !InterfaceKeys.All.Contains(key, StringComparer.Ordinal))
                .ToList();
            if (invalidKeys.Count > 0)
            {
                return BadRequest(new { permissions = $"Interfaces inconnues : {string.Join(", ", invalidKeys)}" });
            }

            var existingPermissions = await _db.UserPermissions
                .Where(permission => permission.UserId == id)
                .ToDictionaryAsync(permission => permission.InterfaceKey);

            foreach (var permission in dto.Permissions)
            {
                if (existingPermissions.TryGetValue(permission.InterfaceKey, out var existingPermission))
                {
                    existingPermission.IsEnabled = permission.IsEnabled;
                }
                else
                {
                    _db.UserPermissions.Add(new UserPermission
                    {
                        UserId = id,
                        InterfaceKey = permission.InterfaceKey,
                        IsEnabled = permission.IsEnabled
                    });
                }
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("projects")]
        public async Task<ActionResult<IEnumerable<AdminProjectDto>>> GetProjects()
        {
            var projects = await _db.Projects
                .AsNoTracking()
                .Select(project => new AdminProjectDto
                {
                    Id = project.Id,
                    Nom = project.Nom,
                    Description = project.Description,
                    Responsable = project.Responsable,
                    MemberCount = project.Members.Count,
                    SprintCount = project.Sprints.Count,
                    TicketCount = project.Tickets.Count
                })
                .ToListAsync();

            return Ok(projects);
        }

        [HttpGet("stats")]
        public async Task<ActionResult<AdminStatsDto>> GetStats()
        {
            var totalUsersByRole = await _db.Users
                .AsNoTracking()
                .Include(user => user.Role)
                .GroupBy(user => user.Role.Description)
                .Select(group => new { Role = group.Key, Count = group.Count() })
                .ToDictionaryAsync(item => item.Role, item => item.Count);

            var ticketStatusCounts = await _db.Tickets
                .AsNoTracking()
                .GroupBy(ticket => ticket.Status)
                .Select(group => new { Status = group.Key, Count = group.Count() })
                .ToListAsync();

            var stats = new AdminStatsDto
            {
                TotalUsers = await _db.Users.CountAsync(),
                TotalUsersByRole = totalUsersByRole,
                TotalProjects = await _db.Projects.CountAsync(),
                TotalSprints = await _db.Sprints.CountAsync(),
                TotalTickets = await _db.Tickets.CountAsync(),
                TotalTicketsByStatus = ticketStatusCounts.ToDictionary(
                    item => item.Status.ToString(),
                    item => item.Count)
            };

            return Ok(stats);
        }

        [HttpDelete("users/{id:int}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _db.Users
                .Include(u => u.ProjectMembers)
                .Include(u => u.UserPermissions)
                .Include(u => u.Commentaires)
                .Include(u => u.Messages)
                .Include(u => u.ChatMessages)
                .Include(u => u.CreatedTickets)
                .Include(u => u.AssignedTickets)
                .Include(u => u.CreatedProjects)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
                return NotFound(new { message = "Utilisateur introuvable." });

            // Get the authenticated admin's user ID from JWT claims
            var authenticatedUserIdClaim = User.FindFirstValue(
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub")
                ?? User.FindFirstValue("nameid");

            if (int.TryParse(authenticatedUserIdClaim, out var authenticatedUserId)
                && authenticatedUserId == id)
            {
                return BadRequest(new { message = "Vous ne pouvez pas supprimer votre propre compte." });
            }

            // Handle Restrict relationships manually before deleting the user
            // 1. Reassign created tickets to the authenticated admin
            if (int.TryParse(authenticatedUserIdClaim, out var adminId))
            {
                foreach (var ticket in user.CreatedTickets)
                {
                    ticket.CreatorId = adminId;
                }

                // 3. Reassign commentaires to the admin
                foreach (var commentaire in user.Commentaires)
                {
                    commentaire.AuthorId = adminId;
                }

                // 4. Reassign messages to the admin
                foreach (var message in user.Messages)
                {
                    message.SenderId = adminId;
                }

                // 5. Reassign chat messages to the admin
                foreach (var chatMessage in user.ChatMessages)
                {
                    chatMessage.SenderId = adminId;
                }

                // 6. Reassign created projects to the admin
                foreach (var project in user.CreatedProjects)
                {
                    project.CreatedById = adminId;
                }
            }

            // 2. Unassign tickets assigned to this user (AssigneeId is nullable)
            foreach (var ticket in user.AssignedTickets)
            {
                ticket.AssigneeId = null;
            }

            // Cascade will handle ProjectMembers, SprintMembers, UserPermissions,
            // ConversationMembers, UserChatPreferences, Notifications
            _db.Users.Remove(user);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Admin deleted user {UserId} ({Email})", id, user.Email);

            return NoContent();
        }

        private static string GenerateSecurePassword()
        {
            const string upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const string lower = "abcdefghijklmnopqrstuvwxyz";
            const string digits = "0123456789";
            const string special = "!@#$%^&*";
            const int length = 12;

            var allChars = upper + lower + digits + special;
            var password = new char[length];

            password[0] = upper[RandomNumberGenerator.GetInt32(upper.Length)];
            password[1] = lower[RandomNumberGenerator.GetInt32(lower.Length)];
            password[2] = digits[RandomNumberGenerator.GetInt32(digits.Length)];
            password[3] = special[RandomNumberGenerator.GetInt32(special.Length)];

            for (var i = 4; i < length; i++)
            {
                password[i] = allChars[RandomNumberGenerator.GetInt32(allChars.Length)];
            }

            for (var i = length - 1; i > 0; i--)
            {
                var j = RandomNumberGenerator.GetInt32(i + 1);
                (password[i], password[j]) = (password[j], password[i]);
            }

            return new string(password);
        }
    }
}
