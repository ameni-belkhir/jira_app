using System.Collections.Generic;
using System.Threading.Tasks;
using Domain.Entity;

namespace Domain.Interfaces
{
    public interface IMessageRepository
    {
        Task<Message?> GetByIdAsync(int id);
        Task<IEnumerable<Message>> GetByConversationIdAsync(int conversationId);
        Task AddAsync(Message message);
        void Update(Message message);
        void Delete(Message message);
        Task<bool> SaveChangesAsync();
    }
}
