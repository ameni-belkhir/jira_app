using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class CreateSubTicketDto
    {
        [Required]
        public string Titre { get; set; } = string.Empty;

        public string? Description { get; set; }

        public int? AssigneeId { get; set; }

        public string? Priority { get; set; }

        // Couleur optionnelle (hex), ex: "#ff0000"
        public string? Color { get; set; }
    }
}
