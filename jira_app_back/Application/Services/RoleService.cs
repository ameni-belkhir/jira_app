using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Domain.Interfaces;

namespace Application.Services
{
    public class RoleService : IRoleService
    {
        private readonly IRoleRepository _roleRepository;

        public RoleService(IRoleRepository roleRepository)
        {
            _roleRepository = roleRepository;
        }

        public async Task<RoleDto?> GetByIdAsync(int id)
        {
            var r = await _roleRepository.GetByIdAsync(id);
            if (r == null) return null;
            return MapToDto(r);
        }

        public async Task<IEnumerable<RoleDto>> GetAllAsync()
        {
            var roles = await _roleRepository.GetAllAsync();
            return roles.Select(MapToDto);
        }

        public async Task<RoleDto> CreateAsync(RoleDto dto)
        {
            var entity = new Role { Description = dto.Description };
            await _roleRepository.AddAsync(entity);
            await _roleRepository.SaveChangesAsync();
            dto.Id = entity.Id;
            return dto;
        }

        public async Task<bool> UpdateAsync(RoleDto dto)
        {
            var entity = await _roleRepository.GetByIdAsync(dto.Id);
            if (entity == null) return false;
            entity.Description = dto.Description;
            _roleRepository.Update(entity);
            return await _roleRepository.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var entity = await _roleRepository.GetByIdAsync(id);
            if (entity == null) return false;
            _roleRepository.Delete(entity);
            return await _roleRepository.SaveChangesAsync();
        }

        private static RoleDto MapToDto(Role r) => new RoleDto { Id = r.Id, Description = r.Description };
    }
}
