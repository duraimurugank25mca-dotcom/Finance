import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/export_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';
import 'projects_screen.dart';
import 'expenses_screen.dart';
import 'income_screen.dart';
import 'invoices_screen.dart';

class DashboardScreen extends StatefulWidget {
  final UserModel currentUser;
  const DashboardScreen({Key? key, required this.currentUser}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardSummaryModel? _summary;
  bool _isLoading = true;
  String? _error;

  final currencyFormatter = NumberFormat.currency(symbol: '₹', decimalDigits: 2, locale: 'en_IN');

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final summary = await ApiService.getDashboardSummary();
      setState(() {
        _summary = summary;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Widget _buildStatCard({
    required String title,
    required double amount,
    required String subtitle,
    required Color color,
    required IconData icon,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                ),
                Icon(icon, color: color, size: 22),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              currencyFormatter.format(amount),
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Duolink Finance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.table_chart_outlined),
            tooltip: 'Export Excel Report',
            onPressed: () => ExportService.showExportExcelModal(context),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ApiService.clearSession();
              if (!mounted) return;
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: AppTheme.primary),
              accountName: Text(user.fullName, style: const TextStyle(fontWeight: FontWeight.w800)),
              accountEmail: Text('${user.email} • ${user.partnerCode != null ? "Partner ${user.partnerCode} Admin" : "Admin"}'),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Text(
                  user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : 'U',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primary),
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.dashboard_outlined),
              title: const Text('Dashboard'),
              selected: true,
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.folder_open_outlined),
              title: const Text('Projects & Accounts'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const ProjectsScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: const Text('Expenses'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const ExpensesScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.account_balance_wallet_outlined),
              title: const Text('Income & Advances'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const IncomeScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.description_outlined),
              title: const Text('Bills & Invoices'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const InvoicesScreen()));
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.table_chart_outlined, color: Color(0xFF16A34A)),
              title: const Text('Export Excel Report', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
              subtitle: const Text('Income, Advances & Expenses (.xlsx)', style: TextStyle(fontSize: 11)),
              onTap: () {
                Navigator.pop(context);
                ExportService.showExportExcelModal(context);
              },
            ),
            if (user.isAdmin) ...[
              const Divider(),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Text('ADMINISTRATION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
              ),
              ListTile(
                leading: const Icon(Icons.people_outline),
                title: const Text('User Management'),
                onTap: () {
                  Navigator.pop(context);
                  // navigate to users
                },
              ),
            ],
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Error: $_error', style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Role indicator banner
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryBackground,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: const Color(0xFFBFDBFE),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.verified_user_rounded,
                              size: 18,
                              color: AppTheme.primary,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              user.partnerCode != null && user.partnerCode != 'ALL'
                                  ? 'Logged in as Partner ${user.partnerCode} (Admin Full Access)'
                                  : 'Logged in as Admin (Full System Access)',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.primary,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Metrics Cards
                      _buildStatCard(
                        title: 'Total Income',
                        amount: _summary?.totalIncome ?? 0,
                        subtitle: 'Direct payments & project advances',
                        color: AppTheme.accentGreen,
                        icon: Icons.trending_up,
                      ),
                      const SizedBox(height: 10),
                      _buildStatCard(
                        title: 'Total Expenses',
                        amount: _summary?.totalExpenses ?? 0,
                        subtitle: 'Company operations & projects',
                        color: AppTheme.accentRed,
                        icon: Icons.trending_down,
                      ),
                      const SizedBox(height: 10),
                      _buildStatCard(
                        title: 'Available Company Balance',
                        amount: _summary?.availableBalance ?? 0,
                        subtitle: 'Total Income − Total Expenses',
                        color: AppTheme.primary,
                        icon: Icons.account_balance,
                      ),
                      const SizedBox(height: 10),
                      _buildStatCard(
                        title: 'Advances Received',
                        amount: _summary?.advancesReceived ?? 0,
                        subtitle: 'Project initial payments received',
                        color: AppTheme.accentAmber,
                        icon: Icons.hourglass_bottom,
                      ),
                      const SizedBox(height: 10),
                      _buildStatCard(
                        title: 'Pending Client Payments',
                        amount: _summary?.pendingClientPayments ?? 0,
                        subtitle: 'Outstanding invoice receivables',
                        color: Colors.purple,
                        icon: Icons.pending_actions,
                      ),

                      const SizedBox(height: 18),
                      // Project stats summary
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('PROJECT FINANCIAL PERFORMANCE',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.textSecondary)),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Project Income:'),
                                  Text(currencyFormatter.format(_summary?.totalProjectIncome ?? 0),
                                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.accentGreen)),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Project Expenses:'),
                                  Text(currencyFormatter.format(_summary?.totalProjectExpenses ?? 0),
                                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.accentRed)),
                                ],
                              ),
                              const Divider(height: 16),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Project Net Profit:', style: TextStyle(fontWeight: FontWeight.w800)),
                                  Text(currencyFormatter.format(_summary?.projectProfit ?? 0),
                                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.primary, fontSize: 16)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
