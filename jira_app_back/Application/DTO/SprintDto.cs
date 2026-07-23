using System;
using System.Collections.Generic;

namespace Application.DTO
{
    public class SprintDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Goal { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public int ProjectId { get; set; }
        public List<TicketDto> Tickets { get; set; } = new List<TicketDto>();
    }
}
