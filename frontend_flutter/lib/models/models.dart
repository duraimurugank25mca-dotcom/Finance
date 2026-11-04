class UserModel {
  final int id;
  final String email;
  final String fullName;
  final String role; // 'Admin' or 'User'
  final bool canCreateProject;
  final bool canEditRecords;
  final bool canDeleteRecords;

  UserModel({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.canCreateProject = false,
    this.canEditRecords = false,
    this.canDeleteRecords = false,
  });

  bool get isAdmin => role == 'Admin';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? 0,
      email: json['email'] ?? '',
      fullName: json['fullName'] ?? json['full_name'] ?? '',
      role: json['role'] ?? 'User',
      canCreateProject: json['canCreateProject'] ?? json['can_create_project'] ?? false,
      canEditRecords: json['canEditRecords'] ?? json['can_edit_records'] ?? false,
      canDeleteRecords: json['canDeleteRecords'] ?? json['can_delete_records'] ?? false,
    );
  }
}

class DashboardSummaryModel {
  final double totalIncome;
  final double totalExpenses;
  final double availableBalance;
  final double totalProjectIncome;
  final double totalProjectExpenses;
  final double advancesReceived;
  final double pendingClientPayments;
  final double projectProfit;

  DashboardSummaryModel({
    required this.totalIncome,
    required this.totalExpenses,
    required this.availableBalance,
    required this.totalProjectIncome,
    required this.totalProjectExpenses,
    required this.advancesReceived,
    required this.pendingClientPayments,
    required this.projectProfit,
  });

  factory DashboardSummaryModel.fromJson(Map<String, dynamic> json) {
    return DashboardSummaryModel(
      totalIncome: (json['total_income'] ?? 0).toDouble(),
      totalExpenses: (json['total_expenses'] ?? 0).toDouble(),
      availableBalance: (json['available_balance'] ?? 0).toDouble(),
      totalProjectIncome: (json['total_project_income'] ?? 0).toDouble(),
      totalProjectExpenses: (json['total_project_expenses'] ?? 0).toDouble(),
      advancesReceived: (json['advances_received'] ?? 0).toDouble(),
      pendingClientPayments: (json['pending_client_payments'] ?? 0).toDouble(),
      projectProfit: (json['project_profit'] ?? 0).toDouble(),
    );
  }
}

class ProjectModel {
  final int id;
  final String projectCode;
  final String name;
  final String clientName;
  final String? clientEmail;
  final String? clientPhone;
  final String? description;
  final String startDate;
  final String status;
  final double contractAmount;
  final double advanceReceived;
  final double totalIncomeReceived;
  final double totalExpenses;
  final double projectProfit;
  final double pendingPayment;

  ProjectModel({
    required this.id,
    required this.projectCode,
    required this.name,
    required this.clientName,
    this.clientEmail,
    this.clientPhone,
    this.description,
    required this.startDate,
    required this.status,
    required this.contractAmount,
    required this.advanceReceived,
    required this.totalIncomeReceived,
    required this.totalExpenses,
    required this.projectProfit,
    required this.pendingPayment,
  });

  factory ProjectModel.fromJson(Map<String, dynamic> json) {
    return ProjectModel(
      id: json['id'] ?? 0,
      projectCode: json['project_code'] ?? '',
      name: json['name'] ?? '',
      clientName: json['client_name'] ?? '',
      clientEmail: json['client_email'],
      clientPhone: json['client_phone'],
      description: json['description'],
      startDate: json['start_date'] ?? '',
      status: json['status'] ?? 'In Progress',
      contractAmount: (json['contract_amount'] ?? 0).toDouble(),
      advanceReceived: (json['advance_received'] ?? 0).toDouble(),
      totalIncomeReceived: (json['total_income_received'] ?? json['total_income'] ?? 0).toDouble(),
      totalExpenses: (json['total_expenses'] ?? 0).toDouble(),
      projectProfit: (json['project_profit'] ?? 0).toDouble(),
      pendingPayment: (json['pending_payment'] ?? 0).toDouble(),
    );
  }
}

class ExpenseModel {
  final int id;
  final String expenseCode;
  final String categoryName;
  final String description;
  final double amount;
  final String expenseDate;
  final String paymentMethod;
  final int? projectId;
  final String? projectName;
  final String paidBy;
  final String? receiptUrl;

  ExpenseModel({
    required this.id,
    required this.expenseCode,
    required this.categoryName,
    required this.description,
    required this.amount,
    required this.expenseDate,
    required this.paymentMethod,
    this.projectId,
    this.projectName,
    required this.paidBy,
    this.receiptUrl,
  });

  factory ExpenseModel.fromJson(Map<String, dynamic> json) {
    return ExpenseModel(
      id: json['id'] ?? 0,
      expenseCode: json['expense_code'] ?? '',
      categoryName: json['category_name'] ?? '',
      description: json['description'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      expenseDate: json['expense_date'] ?? '',
      paymentMethod: json['payment_method'] ?? '',
      projectId: json['project_id'],
      projectName: json['project_name'],
      paidBy: json['paid_by'] ?? '',
      receiptUrl: json['receipt_url'],
    );
  }
}

class IncomeModel {
  final int id;
  final String incomeCode;
  final String clientName;
  final double amount;
  final String paymentDate;
  final String paymentMethod;
  final bool isAdvance;
  final String? projectType;
  final String? projectDetails;
  final String? projectName;
  final String? transactionReference;
  final String? proofAttachment;

  IncomeModel({
    required this.id,
    required this.incomeCode,
    required this.clientName,
    required this.amount,
    required this.paymentDate,
    required this.paymentMethod,
    required this.isAdvance,
    this.projectType,
    this.projectDetails,
    this.projectName,
    this.transactionReference,
    this.proofAttachment,
  });

  factory IncomeModel.fromJson(Map<String, dynamic> json) {
    return IncomeModel(
      id: json['id'] ?? 0,
      incomeCode: json['income_code'] ?? '',
      clientName: json['client_name'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      paymentDate: json['payment_date'] ?? '',
      paymentMethod: json['payment_method'] ?? '',
      isAdvance: json['is_advance'] ?? false,
      projectType: json['project_type'],
      projectDetails: json['project_details'],
      projectName: json['project_name'],
      transactionReference: json['transaction_reference'],
      proofAttachment: json['proof_attachment'],
    );
  }
}

class InvoiceModel {
  final int id;
  final String invoiceNumber;
  final String invoiceDate;
  final String? dueDate;
  final String projectName;
  final String clientName;
  final double totalAmount;
  final double advanceDeduction;
  final double paymentsReceived;
  final double remainingBalance;
  final String status;

  InvoiceModel({
    required this.id,
    required this.invoiceNumber,
    required this.invoiceDate,
    this.dueDate,
    required this.projectName,
    required this.clientName,
    required this.totalAmount,
    required this.advanceDeduction,
    required this.paymentsReceived,
    required this.remainingBalance,
    required this.status,
  });

  factory InvoiceModel.fromJson(Map<String, dynamic> json) {
    return InvoiceModel(
      id: json['id'] ?? 0,
      invoiceNumber: json['invoice_number'] ?? '',
      invoiceDate: json['invoice_date'] ?? '',
      dueDate: json['due_date'],
      projectName: json['project_name'] ?? '',
      clientName: json['client_name'] ?? '',
      totalAmount: (json['total_amount'] ?? 0).toDouble(),
      advanceDeduction: (json['advance_deduction'] ?? 0).toDouble(),
      paymentsReceived: (json['payments_received'] ?? 0).toDouble(),
      remainingBalance: (json['remaining_balance'] ?? 0).toDouble(),
      status: json['status'] ?? 'Issued',
    );
  }
}
