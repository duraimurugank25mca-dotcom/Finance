import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final currencyFormatter = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
  bool _isLoading = true;
  String? _errorMessage;
  List<ProjectModel> _projectsList = [];
  String _selectedFilter = 'All'; // 'All', 'In Progress', 'Completed'
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _fetchProjects();
  }

  Future<void> _fetchProjects() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await ApiService.getProjects();
      if (mounted) {
        setState(() {
          _projectsList = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  List<ProjectModel> get _filteredList {
    return _projectsList.where((p) {
      if (_selectedFilter != 'All' && p.status != _selectedFilter) return false;

      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        final matchesName = p.name.toLowerCase().contains(query);
        final matchesCode = p.projectCode.toLowerCase().contains(query);
        final matchesClient = p.clientName.toLowerCase().contains(query);
        return matchesName || matchesCode || matchesClient;
      }
      return true;
    }).toList();
  }

  double get _totalContractSum {
    return _filteredList.fold(0.0, (sum, p) => sum + p.contractAmount);
  }

  double get _totalProfitSum {
    return _filteredList.fold(0.0, (sum, p) => sum + p.projectProfit);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Projects & Accounts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchProjects,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchProjects,
        color: AppTheme.primary,
        child: Column(
          children: [
            // KPI Summary Header
            Container(
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primary, AppTheme.primaryLight],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withOpacity(0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Contract Value',
                        style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currencyFormatter.format(_totalContractSum),
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'Project Profit',
                        style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currencyFormatter.format(_totalProfitSum),
                        style: const TextStyle(
                          color: Color(0xFF6EE7B7),
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: TextField(
                onChanged: (val) => setState(() => _searchQuery = val),
                decoration: InputDecoration(
                  hintText: 'Search project name, client, code...',
                  hintStyle: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                  prefixIcon: const Icon(Icons.search, size: 20, color: AppTheme.primary),
                  isDense: true,
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
              ),
            ),

            // Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Row(
                children: [
                  _buildFilterChip('All'),
                  const SizedBox(width: 8),
                  _buildFilterChip('In Progress'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Completed'),
                ],
              ),
            ),

            // Projects List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _errorMessage != null
                      ? _buildErrorWidget()
                      : _filteredList.isEmpty
                          ? _buildEmptyWidget()
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                              itemCount: _filteredList.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                return _buildProjectCard(_filteredList[index]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedFilter == label;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) setState(() => _selectedFilter = label);
      },
      selectedColor: AppTheme.primaryBackground,
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
        color: isSelected ? AppTheme.primary : AppTheme.textSecondary,
      ),
      side: BorderSide(
        color: isSelected ? AppTheme.primary : const Color(0xFFE2E8F0),
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    );
  }

  Widget _buildProjectCard(ProjectModel project) {
    final progress = project.contractAmount > 0
        ? (project.totalIncomeReceived / project.contractAmount).clamp(0.0, 1.0)
        : 0.0;

    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE9E5F5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Code & Status Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryBackground,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    project.projectCode,
                    style: const TextStyle(
                      color: AppTheme.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: project.status == 'Completed'
                        ? AppTheme.accentGreen.withOpacity(0.12)
                        : AppTheme.primaryLight.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    project.status,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: project.status == 'Completed'
                          ? AppTheme.accentGreen
                          : AppTheme.primaryLight,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            // Project Title & Client
            Text(
              project.name,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Row(
              children: [
                const Icon(Icons.business_outlined, size: 14, color: AppTheme.textSecondary),
                const SizedBox(width: 4),
                Text(
                  project.clientName,
                  style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Financial Metrics Grid
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildMetricCol('Contract', project.contractAmount, AppTheme.textPrimary),
                      _buildMetricCol('Received', project.totalIncomeReceived, AppTheme.accentGreen),
                      _buildMetricCol('Pending', project.pendingPayment, AppTheme.accentRed),
                      _buildMetricCol('Profit', project.projectProfit, AppTheme.primaryLight),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // Progress Bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 5,
                      backgroundColor: const Color(0xFFE2E8F0),
                      valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.accentGreen),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),

            // Start Date
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Started: ${project.startDate}',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                ),
                Text(
                  '${(progress * 100).toStringAsFixed(0)}% Settled',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCol(String label, double val, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 2),
        Text(
          currencyFormatter.format(val),
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color),
        ),
      ],
    );
  }

  Widget _buildEmptyWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(Icons.folder_open_outlined, size: 48, color: Color(0xFFCBD5E1)),
          SizedBox(height: 12),
          Text(
            'No projects found',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
          ),
          SizedBox(height: 4),
          Text(
            'Client contracts and projects will appear here.',
            style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppTheme.accentRed),
            const SizedBox(height: 12),
            Text(
              _errorMessage ?? 'Unable to load projects',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _fetchProjects,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}
