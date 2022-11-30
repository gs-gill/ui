function AccountViewModel() {
    var self = this;

    self.name = ko.observable('').extend({
        required: true,
        minLength: 3,
        pattern: { message: 'Username cannot contain spaces.', params: '^\\S*$' }
    });

    self.age = ko.observable().extend({
        required: true,
        digit: true,
        minLength: 2,
        maxLength: 2
    });

    self.handleSubmit = function(){
        var errors = ko.validation.group(self);
        if (errors().length > 0) {
            console.log('error occured')
            errors.showAllMessages();
            return;
         }
        var payload = {
            name: self.name(),
            age: self.age()
        }
        console.log('submitted form', payload)
        return true;
    }
};

ko.applyBindings(new AccountViewModel());