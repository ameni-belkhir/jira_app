using System.Collections.Generic;
using System.Threading.Tasks;
using Domain.Entity;

namespace Domain.Interfaces
{
    public interface ISprintRepository
    {
        Task<Sprint?> GetByIdAsync(int id);
        Task<IEnumerable<Sprint>> GetAllAsync();
        Task<IEnumerable<Sprint>> GetByProjectIdAsync(int projectId);
        Task AddAsync(Sprint sprint);
        void Update(Sprint sprint);
        void Delete(Sprint sprint);
        Task<bool> SaveChangesAsync();
    }
}
