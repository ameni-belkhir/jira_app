using System.Threading.Tasks;
using Application.Interfaces;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class ProjectAuthorizationService : IProjectAuthorizationService
    {
        private readonly ApplicationDbContext _context;

        public ProjectAuthorizationService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<string?> GetUserRoleInProjectAsync(int userId, int projectId)
        {
            var member = await _context.ProjectMembers
                .AsNoTracking()
                .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && pm.UserId == userId);

            return member?.RoleInProject;
        }
    }
}
