using Microsoft.AspNetCore.Http;

namespace Application.DTO
{
    public class UploadProfileImageDto
    {
        public IFormFile File { get; set; } = null!;
    }
}
