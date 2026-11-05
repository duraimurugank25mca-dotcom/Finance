import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  final currencyFormatter = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
  bool _isLoading = true;
  String? _errorMessage;
  List<ExpenseModel> _expensesList = [];
  String _selectedCategory = 'All';
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _fetchExpenses();
  }

  Future<void> _fetchExpenses() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await ApiService.getExpenses();
      if (mounted) {
        setState(() {
          _expensesList = list;
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

  List<String> get _categories {
    final set = <String>{'All'};
    for (var e in _expensesList) {
      if (e.categoryName.isNotEmpty) set.add(e.categoryName);
    }
    return set.toList();
  }

  List<ExpenseModel> get _filteredList {
    return _expensesList.where((e) {
      if (_selectedCategory != 'All' && e.categoryName != _selectedCategory) return false;

      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        final matchesDesc = e.description.toLowerCase().contains(query);
        final matchesCode = e.expenseCode.toLowerCase().contains(query);
        final matchesCat = e.categoryName.toLowerCase().contains(query);
        final matchesPaidBy = e.paidBy.toLowerCase().contains(query);
        final matchesProj = (e.projectName ?? '').toLowerCase().contains(query);
        return matchesDesc || matchesCode || matchesCat || matchesPaidBy || matchesProj;
      }
      return true;
    }).toList();
  }

  double get _totalExpensesSum {
    return _filteredList.fold(0.0, (sum, e) => sum + e.amount);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Expenses'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchExpenses,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchExpenses,
        color: AppTheme.primary,
        child: Column(
          children: [
            // KPI Summary Card
            Container(
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF991B1B), Color(0xFFDC2626)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.red.withOpacity(0.25),
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
                        'Total Operating Expenses',
                        style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currencyFormatter.format(_totalExpensesSum),
                        style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${_filteredList.length} items',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
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
                  hintText: 'Search description, category, or code...',
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

            // Category Filter Chips
            if (_categories.length > 1)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Row(
                  children: _categories.map((cat) {
                    final isSelected = _selectedCategory == cat;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(cat),
                        selected: isSelected,
                        onSelected: (sel) {
                          if (sel) setState(() => _selectedCategory = cat);
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
                      ),
                    );
                  }).toList(),
                ),
              ),

            // Main Expenses List
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
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                return _buildExpenseCard(_filteredList[index]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExpenseCard(ExpenseModel item) {
    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE9E5F5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Code, Date & Category Tag
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        item.expenseCode,
                        style: const TextStyle(
                          color: Color(0xFF991B1B),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      item.expenseDate,
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryBackground,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    item.categoryName,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            // Description & Amount
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    item.description,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  currencyFormatter.format(item.amount),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.accentRed,
                  ),
                ),
              ],
            ),

            const Divider(height: 18, color: Color(0xFFF1F5F9)),

            // Footer: Paid By & Linked Project
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.person_outline, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      'Paid by: ${item.paidBy}',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.projectName ?? 'Operations',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(Icons.receipt_long_outlined, size: 48, color: Color(0xFFCBD5E1)),
          SizedBox(height: 12),
          Text(
            'No expenses found',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
          ),
          SizedBox(height: 4),
          Text(
            'Recorded receipts and expenses will appear here.',
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
              _errorMessage ?? 'Unable to load expenses',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _fetchExpenses,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}
