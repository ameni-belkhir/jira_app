using System;

namespace Application.DTO
{
    public class CreateSprintDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Goal { get; set; }
        public int ProjectId { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}
