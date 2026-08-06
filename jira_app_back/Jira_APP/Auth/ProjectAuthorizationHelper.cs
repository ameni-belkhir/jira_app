using System.Threading.Tasks;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jira_APP.Auth
{
    public static class ProjectAuthorizationHelper
    {
        public static async Task<string?> GetUserRoleInProjectAsync(
            ApplicationDbContext db, int userId, int projectId)
        {
            var member = await db.ProjectMembers
                .AsNoTracking()
                .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && pm.UserId == userId);

            return member?.RoleInProject;
        }
    }
}
