using System.Collections.Generic;
using System.Threading.Tasks;
using Application.DTO;

namespace Application.Interfaces
{
    public interface IProjectService
    {
        Task<ProjectDto?> GetByIdAsync(int id);
        Task<IEnumerable<ProjectDto>> GetAllAsync();
        Task<IEnumerable<ProjectDto>> GetProjectsForUserAsync(int userId, string userRole);
        Task<ProjectDto> CreateAsync(ProjectDto dto);
        Task<bool> UpdateAsync(ProjectDto dto);
        Task<bool> DeleteAsync(int id);
    }
}
