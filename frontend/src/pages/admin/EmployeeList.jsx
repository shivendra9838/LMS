import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

import EmployeeTable from '../../components/EmployeeTable';
import Pagination from '../../components/Pagination';

const EmployeeList = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/employees?page=${page}&limit=10&search=${search}`);
      setEmployees(res.data.data);
      setTotalPages(res.data.meta.totalPages);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [page, search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1); // Reset to first page on new search
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your enterprise workforce</p>
        </div>
        <button 
          onClick={() => navigate('/admin/employees/add')}
          className="btn-primary"
        >
          <UserPlus size={18} />
          Add Employee
        </button>
      </div>

      <div className="glass-panel">
        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
          <form onSubmit={handleSearch} className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, code, email, phone..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input-field pl-10"
            />
          </form>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          <EmployeeTable 
            employees={employees} 
            loading={loading} 
            refresh={fetchEmployees}
          />
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/30">
            <Pagination 
              currentPage={page} 
              totalPages={totalPages} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeList;
