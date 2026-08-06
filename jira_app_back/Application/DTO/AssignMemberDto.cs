using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class AssignMemberDto
    {
        [Required]
        public int UserId { get; set; }
    }
}
