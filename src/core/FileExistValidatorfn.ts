import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'FileExist', async: false })
export class FileExistsValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {

    if (value == null) {
      return true;
    }

    for (const file of value) {
      // Check if the file is required and not provided
      if (file.file === undefined && file.fileExistsValidatorOptions?.require === "true") {
        return false;
      }
      if (file.file !== undefined && (file.file.size > file.fileExistsValidatorOptions?.allowedSize ||
        !file.fileExistsValidatorOptions.allowedExtensions.includes(file.file.mimetype))) {
        return false;
      }
    }

    return true;
  }
}
