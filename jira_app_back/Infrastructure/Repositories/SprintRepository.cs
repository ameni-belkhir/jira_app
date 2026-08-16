using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Domain.Entity;
using Domain.Interfaces;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories
{
    public class SprintRepository : ISprintRepository
    {
        private readonly ApplicationDbContext _context;

        public SprintRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(Sprint sprint)
        {
            await _context.Sprints.AddAsync(sprint);
        }

        public void Delete(Sprint sprint)
        {
            _context.Sprints.Remove(sprint);
        }

        public async Task<IEnumerable<Sprint>> GetAllAsync()
        {
            return await _context.Sprints
                .Include(s => s.Tickets)
                .ToListAsync();
        }

        public async Task<Sprint?> GetByIdAsync(int id)
        {
            return await _context.Sprints
                .Include(s => s.Tickets)
                .FirstOrDefaultAsync(s => s.Id == id);
        }

        public async Task<IEnumerable<Sprint>> GetByProjectIdAsync(int projectId)
        {
            return await _context.Sprints
                .Where(s => s.ProjectId == projectId)
                .Include(s => s.Tickets)
                .ThenInclude(t => t.SubTickets)
                .ToListAsync();
        }

        public void Update(Sprint sprint)
        {
            _context.Sprints.Update(sprint);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
