using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class CreateTicketDto
    {
        [Required]
        public string Titre { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public int CreatorId { get; set; }

        public int? AssigneeId { get; set; }

        public int? ProjectId { get; set; }

        public string? Status { get; set; }

        public string? Priority { get; set; }
    }
}
