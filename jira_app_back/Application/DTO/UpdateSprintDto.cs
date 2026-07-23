using System;

namespace Application.DTO
{
    public class UpdateSprintDto
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Goal { get; set; }
        public string? Status { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}
