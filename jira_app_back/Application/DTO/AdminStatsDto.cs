using System.Collections.Generic;

namespace Application.DTO
{
    public class AdminStatsDto
    {
        public int TotalUsers { get; set; }
        public Dictionary<string, int> TotalUsersByRole { get; set; } = new();
        public int TotalProjects { get; set; }
        public int TotalSprints { get; set; }
        public int TotalTickets { get; set; }
        public Dictionary<string, int> TotalTicketsByStatus { get; set; } = new();
    }
}
