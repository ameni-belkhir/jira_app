using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Domain.Entity;
using Domain.Interfaces;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories
{
    public class TicketRepository : ITicketRepository
    {
        private readonly ApplicationDbContext _context;

        public TicketRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(Ticket ticket)
        {
            await _context.Tickets.AddAsync(ticket);
        }

        public void Delete(Ticket ticket)
        {
            _context.Tickets.Remove(ticket);
        }

        public async Task<IEnumerable<Ticket>> GetAllAsync()
        {
            return await _context.Tickets
                .Include(t => t.Assignee)
                .Include(t => t.Creator)
                .Include(t => t.Commentaires)
                .ToListAsync();
        }

        public async Task<Ticket?> GetByIdAsync(int id)
        {
            return await _context.Tickets
                .Include(t => t.Assignee)
                .Include(t => t.Creator)
                .Include(t => t.Commentaires)
                .Include(t => t.Conversations)
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<IEnumerable<Ticket>> GetByProjectIdAsync(int projectId)
        {
            return await _context.Tickets
                .Where(t => t.ProjectId == projectId)
                .Include(t => t.Assignee)
                .Include(t => t.SubTickets)
                .Include(t => t.Commentaires)
                .ToListAsync();
        }

        public async Task<IEnumerable<Ticket>> GetBySprintIdAsync(int sprintId)
        {
            return await _context.Tickets
                .Where(t => t.SprintId == sprintId)
                .Include(t => t.Assignee)
                .Include(t => t.SubTickets)
                .ToListAsync();
        }

        public void Update(Ticket ticket)
        {
            _context.Tickets.Update(ticket);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
