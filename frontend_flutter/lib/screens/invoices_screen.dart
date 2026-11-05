import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  final currencyFormatter = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
  bool _isLoading = true;
  String? _errorMessage;
  List<InvoiceModel> _invoicesList = [];
  String _selectedStatus = 'All';
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _fetchInvoices();
  }

  Future<void> _fetchInvoices() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await ApiService.getInvoices();
      if (mounted) {
        setState(() {
          _invoicesList = list;
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

  List<InvoiceModel> get _filteredList {
    return _invoicesList.where((inv) {
      if (_selectedStatus != 'All' && inv.status != _selectedStatus) return false;

      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        final matchesNum = inv.invoiceNumber.toLowerCase().contains(query);
        final matchesClient = inv.clientName.toLowerCase().contains(query);
        final matchesProj = inv.projectName.toLowerCase().contains(query);
        return matchesNum || matchesClient || matchesProj;
      }
      return true;
    }).toList();
  }

  double get _totalInvoicedSum {
    return _filteredList.fold(0.0, (sum, inv) => sum + inv.totalAmount);
  }

  double get _totalOutstandingSum {
    return _filteredList.fold(0.0, (sum, inv) => sum + inv.remainingBalance);
  }

  Future<void> _openPdf(int invoiceId) async {
    final url = Uri.parse('${ApiService.baseUrl}/invoices/$invoiceId/pdf');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not launch PDF bill viewer.')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error opening PDF: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bills & Invoices'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchInvoices,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchInvoices,
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
                        'Total Invoiced',
                        style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currencyFormatter.format(_totalInvoicedSum),
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'Outstanding Due',
                        style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currencyFormatter.format(_totalOutstandingSum),
                        style: const TextStyle(
                          color: Color(0xFFFCA5A5),
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
                  hintText: 'Search invoice number, client, project...',
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
                  _buildFilterChip('Issued'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Partially Paid'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Paid'),
                ],
              ),
            ),

            // Invoices List
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
                                return _buildInvoiceCard(_filteredList[index]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedStatus == label;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) setState(() => _selectedStatus = label);
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

  Widget _buildInvoiceCard(InvoiceModel inv) {
    Color statusColor;
    Color statusBg;
    if (inv.status == 'Paid') {
      statusColor = AppTheme.accentGreen;
      statusBg = const Color(0xFFD1FAE5);
    } else if (inv.status == 'Partially Paid') {
      statusColor = AppTheme.accentAmber;
      statusBg = const Color(0xFFFEF3C7);
    } else {
      statusColor = AppTheme.primaryLight;
      statusBg = AppTheme.primaryBackground;
    }

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
            // Invoice Number & Status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.receipt_outlined, size: 16, color: AppTheme.primary),
                    const SizedBox(width: 6),
                    Text(
                      inv.invoiceNumber,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    inv.status,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            // Client & Project Info
            Text(
              inv.clientName,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              inv.projectName,
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
            ),

            const SizedBox(height: 12),

            // Financial Summary Grid
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildMetricCol('Total Bill', inv.totalAmount, AppTheme.textPrimary),
                  _buildMetricCol('Adv Deducted', inv.advanceDeduction, const Color(0xFF64748B)),
                  _buildMetricCol('Paid', inv.paymentsReceived, AppTheme.accentGreen),
                  _buildMetricCol('Balance', inv.remainingBalance, inv.remainingBalance > 0 ? AppTheme.accentRed : AppTheme.accentGreen),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Action: View PDF Bill & Date
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Date: ${inv.invoiceDate}',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
                OutlinedButton.icon(
                  onPressed: () => _openPdf(inv.id),
                  style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    side: const BorderSide(color: AppTheme.primaryLight),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  ),
                  icon: const Icon(Icons.picture_as_pdf_outlined, size: 14, color: AppTheme.primaryLight),
                  label: const Text(
                    'PDF Bill',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.primaryLight),
                  ),
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
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color),
        ),
      ],
    );
  }

  Widget _buildEmptyWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(Icons.description_outlined, size: 48, color: Color(0xFFCBD5E1)),
          SizedBox(height: 12),
          Text(
            'No invoices found',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
          ),
          SizedBox(height: 4),
          Text(
            'Generated client bills and invoices will appear here.',
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
              _errorMessage ?? 'Unable to load invoices',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _fetchInvoices,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}

