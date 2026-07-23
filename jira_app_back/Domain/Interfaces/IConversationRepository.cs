using System.Collections.Generic;
using System.Threading.Tasks;
using Domain.Entity;

namespace Domain.Interfaces
{
    public interface IConversationRepository
    {
        Task<Conversation?> GetByIdAsync(int id);
        Task<IEnumerable<Conversation>> GetAllAsync();
        Task AddAsync(Conversation conversation);
        void Update(Conversation conversation);
        void Delete(Conversation conversation);
        Task<bool> SaveChangesAsync();
    }
}
