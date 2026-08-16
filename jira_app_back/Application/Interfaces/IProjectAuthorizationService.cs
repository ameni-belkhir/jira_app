using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IProjectAuthorizationService
    {
        Task<string?> GetUserRoleInProjectAsync(int userId, int projectId);
    }
}
