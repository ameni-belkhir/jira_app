using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class AssignDeveloperDto
    {
        [Required]
        public int UserId { get; set; }

        public int[] SprintIds { get; set; } = Array.Empty<int>();
    }
}
